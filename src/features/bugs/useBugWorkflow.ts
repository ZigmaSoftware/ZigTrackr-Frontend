import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import type { BugDetail } from "@/types";

/* ---- WORKFLOW MUTATIONS ----
   Every workflow action invalidates the same set of caches. Centralising that
   list is the point: closing a bug changes the detail page, the list behind
   it, the dashboard KPIs and the sidebar badges, and an inline invalidation
   written per-dialog would eventually miss one and leave a stale count on
   screen. */
export function useBugWorkflow(bugId: string) {
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.team.workload });
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
  }

  function onSuccess(message: string) {
    return (data: BugDetail) => {
      queryClient.setQueryData(queryKeys.bugs.detail(bugId), data);
      invalidate();
      toast.success(message);
    };
  }

  function onError(error: unknown) {
    // Field-level messages are shown by the dialog; the toast carries the
    // headline so an error is never silent (spec 63).
    toast.error(apiErrorMessage(error));
  }

  const assign = useMutation({
    mutationFn: (payload: { owner: string; remarks?: string; expected_closure_date?: string | null }) =>
      bugApi.assign(bugId, payload),
    onSuccess: onSuccess("Bug assigned"),
    onError,
  });

  const changeStatus = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bugApi.changeStatus(bugId, payload),
    onSuccess: onSuccess("Status updated"),
    onError,
  });

  const recordTest = useMutation({
    mutationFn: (payload: { test_result: string; test_remarks?: string }) =>
      bugApi.recordTest(bugId, payload),
    onSuccess: onSuccess("Test result recorded"),
    onError,
  });

  const resolve = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bugApi.resolve(bugId, payload),
    onSuccess: onSuccess("Bug resolved"),
    onError,
  });

  const close = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bugApi.close(bugId, payload),
    onSuccess: onSuccess("Bug closed"),
    onError,
  });

  const reopen = useMutation({
    mutationFn: (payload: { reopen_reason: string }) => bugApi.reopen(bugId, payload),
    onSuccess: onSuccess("Bug reopened"),
    onError,
  });

  const addUpdate = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bugApi.addUpdate(bugId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success("Daily update added");
    },
    onError,
  });

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) => bugApi.update(bugId, payload),
    onSuccess: onSuccess("Bug updated"),
    onError,
  });

  return {
    assign, changeStatus, recordTest, resolve, close, reopen, addUpdate, update,
    fieldErrors: apiFieldErrors,
  };
}
