import { FormRoot, FormSection, FormField } from './Form';
import { FormInput } from './FormInput';
import { FormSelect } from './FormSelect';
import { FormCombobox } from './FormCombobox';
import { FormDynamicFields } from './FormDynamicFields';
import { FormActions, FormSubmit } from './FormActions';

export type { FormProps, FormSectionProps, FormFieldProps } from './Form';
export type { FormInputProps } from './FormInput';
export type { FormSelectProps } from './FormSelect';
export type { FormComboboxProps } from './FormCombobox';
export type { FormDynamicFieldsProps } from './FormDynamicFields';
export type { FormActionsProps, FormSubmitProps } from './FormActions';
export type { FormContextValue } from './FormContext';
export { useFormContext } from './FormContext';

export const Form = Object.assign(FormRoot, {
  Section: FormSection,
  Field: FormField,
  Input: FormInput,
  Select: FormSelect,
  Combobox: FormCombobox,
  DynamicFields: FormDynamicFields,
  Actions: FormActions,
  Submit: FormSubmit,
});
