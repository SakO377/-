import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';

import { configureNotificationHandler } from '@/lib/notifications';

// アプリを開いている最中でも通知バナーが出るようにする(起動時に1回だけ)
configureNotificationHandler();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  // 通知をタップしてアプリが開かれたら、ミッション画面へ直行する
  const response = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    if (!response) return;
    const responseId = response.notification.request.identifier + response.actionIdentifier;
    if (handledResponse.current === responseId) return;
    handledResponse.current = responseId;

    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url === '/workout') {
      router.push('/workout');
    }
  }, [response, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="workout"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
