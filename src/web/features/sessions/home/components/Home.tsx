import type { ReactNode } from "react";
import { Box, Stack, Title } from "@mantine/core";
import styles from "./Home.module.css";

interface HomeProps {
  search: ReactNode;
  children?: ReactNode;
}

/** Home keeps activity visible below the inline Quick Switcher. */
export function Home({ search, children }: HomeProps) {
  return (
    <div className={styles.page}>
      <Stack gap={22} w="100%" maw={620} mx="auto">
        <Title order={1} size={32} fw={550} ta="center">Lets cook</Title>
        {search}
      </Stack>
      <Box className={styles.activity}>{children}</Box>
    </div>
  );
}
