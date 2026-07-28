import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

// Keep this fallback aligned with the root layout so production builds can run
// without a configured Clerk project while real deployments use their env key.
const BUILD_FALLBACK_CLERK_PK = "pk_test_Y2xlcmsuZHVtbXkuZGV2JA";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Provider invariant: signed-out auth flows get their one provider here;
  // signed-in renders already have the inversely gated root provider.
  if (userId) return children;

  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || BUILD_FALLBACK_CLERK_PK;

  return (
    <ClerkProvider publishableKey={publishableKey} dynamic afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
