// Public tenant configuration, confirmed by the successful EU login probe.
// The native transport separately pins every request to the EU API origin.
export function altaNamespaceNickname(): string {
  return process.env.EXPO_PUBLIC_ALTA_NAMESPACE ?? 'org:ifss-group';
}
