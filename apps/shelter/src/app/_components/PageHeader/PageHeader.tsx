import { Title, Text } from '@mantine/core';

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <Title order={1} className="shelter-display-title">
        {title}
      </Title>
      {description ? (
        <Text c="dimmed" mt="xs">
          {description}
        </Text>
      ) : null}
    </div>
  );
}
