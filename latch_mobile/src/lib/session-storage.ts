// Native storage carries serialized session or recovery metadata, never login inputs.
export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}
