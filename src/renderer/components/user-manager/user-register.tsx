import { useRegister } from "@/api/tanstack/auth.tanstack";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Card, TextInput, PasswordInput, Button, Group, Stack, Title, Text, Progress } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export const validatePassword = [
    { re: /[0-9]/, label: "Includes number" },
    { re: /[a-z]/, label: "Includes lowercase letter" },
    { re: /[A-Z]/, label: "Includes uppercase letter" },
    { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: "Includes special symbol" },
    { re: /^.{6,}$/, label: "At least 6 characters" },
];

const FormSchema = z.object({
    email: z.string().email({ message: "Email không hợp lệ" }),
    password: z
        .string()
        .regex(validatePassword[0].re, { message: validatePassword[0].label })
        .regex(validatePassword[1].re, { message: validatePassword[1].label })
        .regex(validatePassword[2].re, { message: validatePassword[2].label })
        .regex(validatePassword[3].re, { message: validatePassword[3].label })
        .regex(validatePassword[4].re, { message: validatePassword[4].label }),
});

type TProps = {
    className?: string;
};

export default function UserRegister({ className }: TProps) {
    const registerForm = useRegister();
    const [visible, { toggle }] = useDisclosure(false);
    const [password, setPassword] = useState("");
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: { email: "", password: "" },
    });

    const getPasswordStrength = () => {
        let multiplier = password.length > 5 ? 0 : 1;
        validatePassword.forEach((test) => {
            if (test.re.test(password)) multiplier += 1;
        });
        return Math.min((multiplier / validatePassword.length) * 100, 100);
    };

    const strength = getPasswordStrength();
    const strengthColor = strength === 100 ? "teal" : strength > 60 ? "lime" : strength > 30 ? "yellow" : "red";

    const onSubmit = (data: z.infer<typeof FormSchema>) => {
        const payload = {
            email: data.email.trim(),
            password: data.password.trim(),
        };

        registerForm.mutate(payload, {
            onSuccess: () => {
                form.reset();
                toast.success("Register successfully");
                queryClient.invalidateQueries({ queryKey: [`get-list-user`] });
            },
        });
    };

    return (
        <Card radius="lg" p="xl" className={cn("w-full max-w-md mx-auto", className)} withBorder>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Stack gap={"xs"}>
                    <Title order={3}>Create Account</Title>

                    {/* Email */}
                    <TextInput label="Email" placeholder="you@example.com" {...form.register("email")} error={form.formState.errors.email?.message} />

                    {/* Password */}
                    <PasswordInput
                        label="Password"
                        placeholder="Enter password"
                        visible={visible}
                        onVisibilityChange={toggle}
                        {...form.register("password")}
                        error={form.formState.errors.password?.message}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            form.setValue("password", e.target.value);
                        }}
                    />

                    {/* Strength indicator */}
                    <Stack gap={0} h={"5px"}>
                        {password.length > 0 && <Progress color={strengthColor} value={strength} size="sm" />}
                    </Stack>

                    {/* Submit */}
                    <Group justify="center">
                        <Button type="submit" fullWidth loading={registerForm.isPending} radius="md">
                            Create Account
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Card>
    );
}
