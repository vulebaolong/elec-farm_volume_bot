'use client';

import { Input } from '@/components/ui/input';
import { ROUTER } from '@/constant/router.constant';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useRegister } from '@/api/tanstack/auth.tanstack';
import ThemeToggleV2 from '@/components/theme-toggle/theme-toggle-v2';
import { ButtonLoading } from '@/components/ui/button-loading';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/ui/password-input';
import { GalleryVerticalEnd } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const validatePassword = [
  { re: /[0-9]/, label: 'Includes number.' },
  { re: /[a-z]/, label: 'Includes lowercase letter.' },
  { re: /[A-Z]/, label: 'Includes uppercase letter.' },
  { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: 'Includes special symbol.' },
  { re: /^.{6,}$/, label: 'Includes at least 6 characters.' },
];

const FormSchema = z.object({
  email: z.email({ message: 'Email không hợp lệ' }),
  password: z
    .string()
    .regex(validatePassword[0].re, { message: validatePassword[0].label })
    .regex(validatePassword[1].re, { message: validatePassword[1].label })
    .regex(validatePassword[2].re, { message: validatePassword[2].label })
    .regex(validatePassword[3].re, { message: validatePassword[3].label })
    .regex(validatePassword[4].re, { message: validatePassword[4].label }),
});

export function Register({ className, ...props }: React.ComponentProps<'div'>) {
  const registerForm = useRegister();
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: `admin@gmail.com`,
      password: `Admin@123`,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const payload = {
      email: data.email.trim(),
      password: data.password.trim(),
    };
    registerForm.mutate(payload, {
      onSuccess: (data) => {
        navigate(ROUTER.LOGIN);
        toast.success(`Register successfully`);
      },
    });
  }

  return (
    <div className={cn('flex flex-col gap-6 max-w-sm', className)} {...props}>
      {/* logo */}
      <div className="flex flex-col items-center gap-2">
        <a href="#" className="flex flex-col items-center gap-2 font-medium">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <span className="sr-only">Acme Inc.</span>
        </a>
        <h1 className="text-xl font-bold">Create your account</h1>
        <div className="text-center text-sm">
          Already have an account?{' '}
          <Button
            className="text-sm font-light p-0"
            onClick={() => navigate(ROUTER.LOGIN)}
            variant="link"
          >
            Log in
          </Button>
        </div>
      </div>

      {/* form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="h-[75px] content-start gap-1">
                  <FormLabel className="mb-[3px]">Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Email" {...field} />
                  </FormControl>
                  <FormMessage className="leading-none text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="h-[75px] content-start gap-1">
                  <FormLabel className="mb-[3px]">Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="Password" {...field} />
                  </FormControl>
                  <FormMessage className="leading-none text-xs" />
                </FormItem>
              )}
            />
            <ButtonLoading
              loading={registerForm.isPending}
              type="submit"
              className="w-full"
            >
              Create Account
            </ButtonLoading>
          </div>
        </form>
      </Form>

      {/* toggle theme */}
      <div className="flex items-center justify-center">
        <ThemeToggleV2 />
      </div>

      {/* footer */}
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By signing up, you agree to our <br /><a href="#">Terms of Service</a> and {' '}
        <a href="#">Privacy Policy</a>.
      </div>
    </div>
  );
}
