type FormErrors = {
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
};

// In-memory store for form validation errors keyed by connection ID.
// Errors are cleared when the SSE connection closes or on successful submission.
class FormErrorStore {
  private errors = new Map<string, FormErrors>();

  // Stores validation errors for a connection
  setErrors(connectionId: string, errors: FormErrors): void {
    this.errors.set(connectionId, errors);
  }

  // Retrieves validation errors for a connection
  getErrors(connectionId: string): FormErrors | null {
    return this.errors.get(connectionId) || null;
  }

  // Clears validation errors for a connection
  clearErrors(connectionId: string): void {
    this.errors.delete(connectionId);
  }
}

export const formErrorStore = new FormErrorStore();
export type { FormErrors };
