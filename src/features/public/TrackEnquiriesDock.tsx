import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Minus, Phone, Plus, X } from "lucide-react";
import "./TrackEnquiriesDock.css";

const contacts = [
  { level: "L1", name: "Dimple", number: "+918567746474", display: "+91 85677 46474" },
  { level: "L2", name: "Mouly", number: "+919564744476", display: "+91 95647 44476" },
  { level: "L3", name: "Dinesh", number: "+919264744579", display: "+91 92647 44579" },
];

export function TrackEnquiriesDock() {
  const [open, setOpen] = useState(false);
  return <aside className="track-enquiries" aria-label="Support enquiries">
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="track-enquiries-trigger" type="button">
          <Phone size={17} aria-hidden /><span>For enquiries</span>{open ? <Minus size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
        </button>
      </Popover.Trigger>
      <Popover.Content className="track-enquiries-panel" side="top" align="end" sideOffset={12} collisionPadding={16}
        aria-labelledby="track-enquiries-title" aria-describedby="track-enquiries-description">
        <header className="track-enquiries-heading">
          <div><h2 id="track-enquiries-title">For enquiries</h2><p id="track-enquiries-description">Get in touch with our support team.</p></div>
          <Popover.Close className="track-enquiries-close" aria-label="Close enquiries"><X size={15} aria-hidden /></Popover.Close>
        </header>
        <ul className="track-enquiries-list">{contacts.map(({ level, name, number, display }) => <li className="track-enquiries-contact" key={level}>
          <span className="track-enquiries-level">{level}</span>
          <div><strong>{name}</strong><a className="track-enquiries-number" href={`tel:${number}`}>{display}</a></div>
          <a className="track-enquiries-call" href={`tel:${number}`} aria-label={`Call ${name}, ${level}`} title={`Call ${name}`}><Phone size={16} aria-hidden /></a>
        </li>)}</ul>
        <p className="track-enquiries-note">Please have your ticket number ready when calling.</p>
      </Popover.Content>
    </Popover.Root>
  </aside>;
}
