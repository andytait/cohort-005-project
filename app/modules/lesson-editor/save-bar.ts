export type SaveBarState = {
  label: string;
  status: string;
  disabled: boolean;
};

export function saveBarState({
  hasChanges,
  saving,
}: {
  hasChanges: boolean;
  saving: boolean;
}): SaveBarState {
  if (saving) {
    return {
      label: "Saving...",
      status: "Saving your changes.",
      disabled: true,
    };
  }
  if (hasChanges) {
    return {
      label: "Save Changes",
      status: "You have unsaved changes.",
      disabled: false,
    };
  }
  return {
    label: "Save Changes",
    status: "All changes saved.",
    disabled: true,
  };
}
