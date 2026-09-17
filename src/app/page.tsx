export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-card px-4 py-2">
        <h1 className="font-heading text-lg font-semibold">Личная CRM</h1>
      </header>
      <main className="grid flex-1 md:grid-cols-[minmax(18rem,36%)_1fr]">
        <section
          aria-label="Список контактов"
          className="border-b bg-card md:border-r md:border-b-0"
        />
        <section aria-label="Карточка контакта" />
      </main>
    </div>
  );
}
