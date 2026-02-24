import { View, Text, FlatList } from "react-native";
import type { MediaItem } from "@tentacle/shared";

interface Props {
  title: string;
  data: MediaItem[];
  renderItem: (item: MediaItem) => React.ReactNode;
}

export function MediaRow({ title, data, renderItem }: Props) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700", paddingHorizontal: 16, marginBottom: 10 }}>
        {title}
      </Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.Id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={{ width: 120 }}>
            {renderItem(item)}
          </View>
        )}
      />
    </View>
  );
}
