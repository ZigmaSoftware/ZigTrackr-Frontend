import { forwardRef } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes,
  SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---- BUTTON ---- */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium " +
    "transition-colors disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
        destructive: "bg-[var(--destructive)] text-white hover:opacity-90",
        outline: "border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]",
        secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-80",
        ghost: "hover:bg-[var(--muted)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 text-sm [&_svg]:size-4",
        sm: "h-8 px-2.5 text-[13px] [&_svg]:size-3.5",
        lg: "h-10 px-5 text-sm [&_svg]:size-4",
        icon: "h-8 w-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className);

    // Radix Slot merges props onto exactly one child element, so it must not be
    // handed a spinner alongside `children` -- doing so throws "Slot failed to
    // slot onto its children" and takes the whole page down. asChild is for
    // wrapping a single element (typically a Link), where a loading spinner
    // makes no sense anyway.
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

/* ---- ICON BUTTON ----
   `label` is required, not optional: an icon-only control with no accessible
   name is invisible to a screen reader, and making it a type error is the only
   reliable way to prevent that (spec 49). */
export interface IconButtonProps extends Omit<ButtonProps, "size" | "children"> {
  label: string;
  children: ReactNodeIcon;
}
type ReactNodeIcon = React.ReactNode;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, children, variant = "ghost", className, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    >
      {children}
    </Button>
  ),
);
IconButton.displayName = "IconButton";

/* ---- FIELD SURFACE ----
   Inputs sit on --card in dialogs and on --background in pages, so a --card
   fill makes them vanish against a dialog. A recessed --background fill plus a
   mixed-down border reads as an editable well on both surfaces, and the ring on
   focus is what tells a keyboard user where they are. */
const FIELD_BASE = cn(
  "flex w-full rounded-lg border bg-[var(--background)] text-sm transition-colors",
  "border-[var(--input)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
  "hover:border-[color-mix(in_oklab,var(--input)_60%,var(--muted-foreground))]",
  "focus-visible:border-[var(--ring)] focus-visible:outline-none",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--ring)_28%,transparent)]",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--muted)]",
  "aria-[invalid=true]:border-[var(--destructive)]",
  "aria-[invalid=true]:focus-visible:ring-[color-mix(in_oklab,var(--destructive)_28%,transparent)]",
);

/* ---- INPUT ---- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(FIELD_BASE, "h-9 px-3 py-1", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/* ---- TEXTAREA ---- */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, "min-h-[80px] resize-y px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

/* ---- NATIVE SELECT ----
   Deliberately native: it is keyboard accessible for free, works on mobile,
   and this application has many small selects where a custom listbox would be
   weight without benefit. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        FIELD_BASE,
        "h-9 cursor-pointer appearance-none bg-no-repeat py-0 pl-3 pr-8",
        "bg-[image:var(--select-chevron)] bg-[position:right_0.65rem_center] bg-[size:0.7rem]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

/* ---- LABEL ---- */
export function Label({
  className, required, children, ...props
}: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string; required?: boolean }) {
  return (
    <label className={cn("text-[13px] font-medium text-[var(--foreground)]", className)} {...props}>
      {children}
      {required ? <span className="ml-0.5 text-[var(--destructive)]" aria-hidden>*</span> : null}
    </label>
  );
}

/* ---- CARD ---- */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("zcard", className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

/* ---- SKELETON (spec 55) ---- */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--muted)]", className)}
      aria-hidden
      {...props}
    />
  );
}

/* ---- SPINNER ---- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}
