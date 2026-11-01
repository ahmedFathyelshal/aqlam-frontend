import { ApiValidationError } from './api-error.utils';

describe('ApiValidationError.fromResponseBody', () => {
  it('keeps field errors from a ValidationProblemDetails body', () => {
    const error = ApiValidationError.fromResponseBody({
      title: 'One or more validation errors occurred.',
      errors: { userName: ['Username is required.'], password: ['Too short.', 'Needs a digit.'] },
    });

    expect(error.fieldErrors['userName']).toEqual(['Username is required.']);
    expect(error.fieldErrors['password']).toHaveLength(2);
    expect(error.errors).toEqual(['Username is required.', 'Too short.', 'Needs a digit.']);
  });

  it('uses the flat list from a Result failure body', () => {
    const error = ApiValidationError.fromResponseBody({ succeeded: false, errors: ['Add at least one lesson.'] });

    expect(error.errors).toEqual(['Add at least one lesson.']);
    expect(error.fieldErrors).toEqual({});
  });

  it('falls back to a generic message for unknown bodies', () => {
    expect(ApiValidationError.fromResponseBody(null).errors).toEqual(['A validation error occurred.']);
    expect(ApiValidationError.fromResponseBody('Bad input').errors).toEqual(['Bad input']);
  });
});
