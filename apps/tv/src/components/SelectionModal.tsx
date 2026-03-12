import { useRef } from "react";
import { View, Text, ScrollView, Modal } from "react-native";
import { Focusable } from "./focus/Focusable";
import { useTVScrollToFocused } from "../hooks/useTVScrollToFocused";
import { CheckIcon } from "./icons/TVIcons";
import { Colors, Radius } from "../theme/colors";

interface SelectionOption {
  value: string;
  label: string;
}

interface SelectionModalProps {
  title: string;
  options: SelectionOption[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

const OPTION_HEIGHT = 56;

export function SelectionModal({ title, options, selectedValue, onSelect, onClose }: SelectionModalProps) {
  const optionsScrollRef = useRef<ScrollView>(null);
  const { makeOnFocus } = useTVScrollToFocused(optionsScrollRef, 40);

  const selectedIdx = options.findIndex((o) => o.value === selectedValue);
  const focusIdx = selectedIdx >= 0 ? selectedIdx : 0;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
      }}>
        <View style={{
          width: 420, maxHeight: "70%",
          backgroundColor: Colors.glassBgHeavy,
          borderRadius: Radius.modal,
          borderWidth: 1, borderColor: Colors.glassBorder,
          overflow: "hidden",
        }}>
          {/* Header */}
          <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            paddingHorizontal: 28, paddingVertical: 20,
            borderBottomWidth: 1, borderBottomColor: Colors.divider,
          }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: "700" }}>
              {title}
            </Text>
          </View>

          {/* Options list */}
          <ScrollView
            ref={optionsScrollRef}
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === selectedValue;
              return (
                <Focusable
                  key={opt.value}
                  variant="row"
                  onPress={() => onSelect(opt.value)}
                  hasTVPreferredFocus={idx === focusIdx}
                  onFocus={makeOnFocus(idx, OPTION_HEIGHT)}
                >
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    paddingVertical: 14, paddingHorizontal: 16,
                    borderRadius: Radius.small, marginBottom: 2,
                    backgroundColor: isSelected ? "rgba(139, 92, 246, 0.15)" : "transparent",
                  }}>
                    <View style={{ width: 28, alignItems: "center" }}>
                      {isSelected && <CheckIcon size={16} color={Colors.accentPurple} />}
                    </View>
                    <Text style={{
                      color: isSelected ? Colors.textPrimary : Colors.textSecondary,
                      fontSize: 16, fontWeight: isSelected ? "600" : "400",
                    }}>
                      {opt.label}
                    </Text>
                  </View>
                </Focusable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
