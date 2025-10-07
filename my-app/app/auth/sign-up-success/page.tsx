import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Header from "@/components/header"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Sign Up Success" />

      <div className="flex min-h-[calc(100vh-80px)] w-full items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Card className="border-2 border-foreground rounded-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Thank you for signing up!</CardTitle>
              <CardDescription>Check your email to confirm</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;ve successfully signed up. Please check your email to confirm your account before signing in.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

