import { useQuery } from "@tanstack/react-query";
import { masterApi, userApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import type { MasterRow, UserLite } from "@/types";

/* Master lists change rarely, so they are cached generously: every bug form
   and filter panel needs them and refetching on each mount would be pure
   waste (spec 47 warns against repeated API calls). */
const MASTER_STALE_TIME = 5 * 60_000;

export function useMasterOptions(resource: string, params?: Record<string, unknown>, enabled = true) {
  return useQuery({
    queryKey: queryKeys.masters.list(resource, params),
    queryFn: () => masterApi.list(resource, params),
    staleTime: MASTER_STALE_TIME,
    enabled,
    select: (data) => data.results,
  });
}

export function useProjects() {
  return useMasterOptions("projects");
}

/** Modules for one project. Disabled until a project is chosen, so the cascade
 *  never fires a pointless request. */
export function useModules(projectId?: string | null) {
  return useMasterOptions("modules", { project: projectId }, Boolean(projectId));
}

export function useSubmodules(moduleId?: string | null) {
  return useMasterOptions("submodules", { module: moduleId }, Boolean(moduleId));
}

export function usePriorities() {
  return useMasterOptions("priorities");
}

export function useSeverities() {
  return useMasterOptions("severities");
}

export function useRootCauseTypes() {
  return useMasterOptions("root-cause-types");
}

export function useDepartments() {
  return useMasterOptions("departments");
}

export function useSites() {
  return useMasterOptions("sites");
}

export function useTeams() {
  return useMasterOptions("teams");
}

/** `roles` narrows the list, e.g. ["DEVELOPER"] for a routing dropdown. */
export function useAssignableUsers(roles?: string[]) {
  const key = roles?.length ? roles.join(",") : "";
  return useQuery<UserLite[]>({
    queryKey: [...queryKeys.users.assignable, key],
    queryFn: () => userApi.assignable(key || undefined),
    staleTime: MASTER_STALE_TIME,
  });
}

export type { MasterRow };
