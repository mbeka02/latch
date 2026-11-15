// The native-storage seam carries only a serialized session, never login inputs.
export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  clear(): Promise<void>;
}
