import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, CardBody, Input, Label, Select, Textarea } from "@/components/ui/primitives";

export function CreateTicketPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ticketType, setTicketType] = useState("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => ticketApi.create({
      ticket_type: ticketType,
      title,
      description,
    }),
    onSuccess: async (ticket) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
      toast.success(`${ticket.reference} created`);
      navigate(`/tickets/detail/${ticket.id}`);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to create ticket.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 5) {
      toast.error("Give the ticket a clear title.");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Add enough detail for review.");
      return;
    }
    create.mutate();
  }

  return (
    <>
      <PageHeader
        title="Create Ticket"
        description="Capture the request. Routing, priority and assignment happen from Unassigned Tickets."
        breadcrumbs={[{ label: "Ticket Creation" }, { label: "Create Ticket" }]}
      />

      <form onSubmit={submit} noValidate className="max-w-3xl">
        <Card>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="ticket_type" required>Ticket type</Label>
                <Select
                  id="ticket_type"
                  value={ticketType}
                  onChange={(event) => setTicketType(event.target.value)}
                >
                  <option value="BUG">Bug</option>
                  <option value="SERVICE_REQUEST">Service Request</option>
                  <option value="ACCESS_REQUEST">Access Request</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title" required>Title / Subject</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Short summary of the request"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" required>Description / Request Details</Label>
              <Textarea
                id="description"
                rows={8}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is needed, what happened, and any useful context."
              />
            </div>
          </CardBody>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={create.isPending}><Save /> Create Ticket</Button>
        </div>
      </form>
    </>
  );
}
