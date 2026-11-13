import {type UseFormReturnType} from "@mantine/form";
import {ZodError} from "zod";

export function handleApiZodError<T>(
    errors: { field: string | number; message: string }[],
    form: UseFormReturnType<T>,
) {
    errors.forEach((error) => {
        const { field, message } = error;

        form.setFieldError(`${field}`, message);
    });
}

export const zodErrorParser = (zodError: ZodError) => {
    const errors: { field: string | number; message: string }[] = [];

    for (const error of zodError.errors) {
        errors.push({ field: error.path[0] ?? "unknown", message: error.message });
    }

    return errors;
};
