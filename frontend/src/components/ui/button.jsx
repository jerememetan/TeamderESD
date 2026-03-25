import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

const buttonVariants = cva(
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:-translate-y-px shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        success: 'border-[rgba(46,204,113,0.32)] bg-[linear-gradient(180deg,rgba(46,204,113,0.18),rgba(46,204,113,0.08))] text-[#0c6b36] hover:bg-[linear-gradient(180deg,rgba(46,204,113,0.22),rgba(46,204,113,0.12))]',
        warning: 'border-[rgba(255,107,0,0.26)] bg-[linear-gradient(180deg,rgba(255,107,0,0.16),rgba(255,107,0,0.08))] text-[#8b3900] hover:bg-[linear-gradient(180deg,rgba(255,107,0,0.2),rgba(255,107,0,0.1))]',
        destructive:
          'border-destructive bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'border-transparent bg-transparent hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'border-transparent bg-transparent text-primary underline-offset-4 shadow-none hover:underline',
      },
      size: {
        default: 'min-h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'min-h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'min-h-11 px-6 has-[>svg]:px-4',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }