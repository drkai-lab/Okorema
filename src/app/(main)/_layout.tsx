import { Tabs, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useApp } from "@/state/store";
import { colors } from "@/ui/theme";
import { AddButton } from "@/ui/ui";

export default function MainLayout() {
  const app = useApp();
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.persimmon,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarStyle: {
            backgroundColor: colors.paper,
            borderTopColor: colors.line,
            height: 64,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: app.messages.home,
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="lists"
          options={{
            title: app.messages.lists,
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-bulleted" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: app.messages.settings,
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" color={color} size={size} />,
          }}
        />
      </Tabs>
      <AddButton label={app.messages.addReminder} onPress={() => router.push({ pathname: "/reminder/[id]", params: { id: "new" } })} />
    </>
  );
}
