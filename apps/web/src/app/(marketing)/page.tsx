import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">RepCheck</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Analyze your lifts in the browser. No upload needed.
      </p>
      <Button asChild size="lg">
        <Link href="/analyze">Try it</Link>
      </Button>
    </main>
  )
}
