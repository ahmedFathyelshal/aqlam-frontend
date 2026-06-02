export interface ApiResponse<T = any> {
  data: T;
  succeeded: boolean;
  errors: string[];
}
