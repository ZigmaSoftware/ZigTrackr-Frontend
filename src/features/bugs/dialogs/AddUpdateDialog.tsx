import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/feedback/Modal";
import { Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { useBugWorkflow } from "@/features/bugs/useBugWorkflow";

const schema = z.object({
  update_text: z.string().min(3, "Describe what happened today"),
  next_action: z.string().optional(),
  expected_completion_date: z.string().optional(),
  remarks: z.string().optional(),
});

type Values = z.infer<typeof schema>;

/* Spec 10: a daily update is appended, never an edit of yesterday's. */
export function AddUpdateDialog({
  bugId, bugNo, open, onOpenChange,
}: { bugId: string; bugNo: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addUpdate } = useBugWorkflow(bugId);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: Values) {
    await addUpdate.mutateAsync({
      ...values,
      expected_completion_date: values.expected_completion_date || undefined,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add daily update"
      description={`${bugNo} — this is appended to the history and cannot be edited later.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={addUpdate.isPending}>
            Add update
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="update_text" required>Today's update</Label>
          <Textarea
            id="update_text"
            rows={3}
            placeholder="What progress was made today?"
            aria-invalid={Boolean(errors.update_text)}
            {...register("update_text")}
          />
          {errors.update_text ? (
            <p className="text-[12px] text-[var(--destructive)]">{errors.update_text.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="next_action">Next action</Label>
          <Input id="next_action" placeholder="What happens next?" {...register("next_action")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expected_completion_date">Revised expected closure</Label>
          <Input id="expected_completion_date" type="date" {...register("expected_completion_date")} />
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Leave blank to keep the current date.
          </p>
        </div>
      </form>
    </Modal>
  );
}
