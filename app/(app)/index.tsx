import { Redirect, type Href } from 'expo-router';

const tabsRoot = '/(app)/(tabs)' as Href;

export default function AppIndexRedirect() {
  return <Redirect href={tabsRoot} />;
}
