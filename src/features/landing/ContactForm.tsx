import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.email('Enter a valid email'),
  department: z.string().trim().optional(),
  topic: z.enum(['Request a demo', 'Access request', 'Payroll concern', 'Integration', 'Other']),
  message: z.string().trim().min(10, 'Tell us a bit more'),
})

type FormValues = z.infer<typeof schema>

export function ContactForm() {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { topic: 'Request a demo' } })

  // TODO: POST to aznar-api /support once the backend is live
  const onSubmit = handleSubmit(async () => {
    await new Promise((r) => setTimeout(r, 700))
    reset()
    setSent(true)
  })

  if (sent) {
    return (
      <div className="card flex h-full flex-col items-center justify-center p-10 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h3 className="mt-4 text-xl font-bold">Message sent!</h3>
        <p className="mt-2 text-muted">The payroll team will get back to you within one working day.</p>
        <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
          Send another
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.message}>
          <Input {...register('name')} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} autoComplete="email" />
        </Field>
        <Field label="Department (optional)">
          <Input {...register('department')} placeholder="e.g. Finance" />
        </Field>
        <Field label="Topic">
          <Select {...register('topic')}>
            {schema.shape.topic.options.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Message" error={errors.message?.message}>
        <Textarea rows={5} {...register('message')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        <Send className="size-4" /> {isSubmitting ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  )
}
