/** A short tap of the phone's vibration for an action that matters (start recording, set the watch). */
export function tapFeel(): void {
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }))
    .catch(() => navigator.vibrate?.(40));
}
