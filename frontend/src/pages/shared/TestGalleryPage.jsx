import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Separator } from '../../components/ui/separator'
import { Switch } from '../../components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Textarea } from '../../components/ui/textarea'

function CodePill({ children }) {
  return (
    <code className="rounded-md border bg-background px-2 py-1 text-xs text-foreground">
      {children}
    </code>
  )
}

function UsageList({ items }) {
  return (
    <div className="space-y-2 rounded-lg border bg-background/70 p-4 text-sm text-muted-foreground">
      {items.map((item) => (
        <p key={item}>
          {item}
        </p>
      ))}
    </div>
  )
}

function Section({ title, description, children }) {
  return (
    <Card className="gap-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function TestGalleryPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">Developer Reference</Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Teamder Component Gallery
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              This page is for us as developers. Each section shows what a
              component looks like, when we should use it, and the main props or
              composition pattern to remember while building Teamder screens.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">Back Home</Link>
          </Button>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>How To Read This Page</CardTitle>
            <CardDescription>
              Treat this like a working UI handbook for the current migrated component set.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="font-medium text-foreground">Preview</p>
              <p>See how the component actually looks in our app theme.</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="font-medium text-foreground">Usage notes</p>
              <p>Quick guidance on when to use the component in Teamder screens.</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="font-medium text-foreground">API hints</p>
              <p>Short reminders like <CodePill>variant</CodePill>, <CodePill>asChild</CodePill>, or composition patterns.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section
            title="Buttons and Badges"
            description="Use buttons for actions and badges for short status labels"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <CodePill>{'<Button variant="outline" />'}</CodePill>
              <CodePill>{'<Button asChild />'}</CodePill>
              <CodePill>{'<Badge variant="secondary" />'}</CodePill>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Alert</Badge>
            </div>
            <div className="mt-6">
              <UsageList
                items={[
                  'Use Button for main user actions like save, submit, create team, or view details.',
                  'Use Badge for tiny status labels like Open, Draft, Assigned, or Pending.',
                  'Use asChild on Button when the clickable element should really be a Link.',
                ]}
              />
            </div>
          </Section>

          <Section
            title="Inputs"
            description="Core form inputs for profile forms, filters, and setup flows"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <CodePill>{'<Input placeholder="..." />'}</CodePill>
              <CodePill>{'<Label htmlFor="..." />'}</CodePill>
              <CodePill>{'<Textarea />'}</CodePill>
              <CodePill>{'<Select><SelectTrigger /></Select>'}</CodePill>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="student-name">Student name</Label>
                <Input id="student-name" placeholder="Alicia Tan" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-role">Preferred role</Label>
                <Select defaultValue="backend">
                  <SelectTrigger id="student-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backend">Backend</SelectItem>
                    <SelectItem value="frontend">Frontend</SelectItem>
                    <SelectItem value="fullstack">Full Stack</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="student-bio">Short bio</Label>
                <Textarea
                  id="student-bio"
                  placeholder="Interested in backend APIs and integration work."
                />
              </div>
            </div>
            <div className="mt-6">
              <UsageList
                items={[
                  'Wrap visible field names with Label and connect them using htmlFor and id.',
                  'Use Input for short values, Textarea for free text, and Select when choices are constrained.',
                  'This group is useful for student onboarding, team preferences, and course configuration forms.',
                ]}
              />
            </div>
          </Section>

          <Section
            title="Switches and Settings"
            description="Binary settings for feature flags and simple yes-or-no preferences"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <CodePill>{'<Switch checked={state} onCheckedChange={setState} />'}</CodePill>
              <CodePill>{'checked'}</CodePill>
              <CodePill>{'onCheckedChange'}</CodePill>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="notifications">Enable notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Example toggle for future team alerts.
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
            <div className="mt-6">
              <UsageList
                items={[
                  'Use Switch only for immediate on/off state, not for choosing between many options.',
                  'Good examples: notifications, allow swaps, enable auto-grouping, show archived teams.',
                ]}
              />
            </div>
          </Section>

          <Section
            title="Tabs"
            description="Section switching inside a page without navigating to a full new route"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <CodePill>{'<Tabs defaultValue="overview" />'}</CodePill>
              <CodePill>{'<TabsList />'}</CodePill>
              <CodePill>{'<TabsTrigger value="..." />'}</CodePill>
              <CodePill>{'<TabsContent value="..." />'}</CodePill>
            </div>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="rounded-lg border bg-background p-4">
                Overview content preview.
              </TabsContent>
              <TabsContent value="members" className="rounded-lg border bg-background p-4">
                Members content preview.
              </TabsContent>
              <TabsContent value="settings" className="rounded-lg border bg-background p-4">
                Settings content preview.
              </TabsContent>
            </Tabs>
            <div className="mt-6">
              <UsageList
                items={[
                  'Use Tabs when the user stays on the same screen context but needs to switch sections.',
                  'Good examples: team details, course dashboard sections, analytics breakdowns.',
                  'Avoid tabs when the content should really be a separate page with its own route.',
                ]}
              />
            </div>
          </Section>

          <Section
            title="Card Layout"
            description="Default content container for dashboards, summaries, and grouped UI blocks"
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <CodePill>{'<Card />'}</CodePill>
              <CodePill>{'<CardHeader />'}</CodePill>
              <CodePill>{'<CardContent />'}</CodePill>
              <CodePill>{'<CardFooter />'}</CodePill>
            </div>
            <Card className="border-dashed bg-background">
              <CardHeader>
                <CardTitle>Example Card</CardTitle>
                <CardDescription>
                  Use this pattern to group related information and actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                This could become a student profile summary, team card, project card,
                or a dashboard metrics panel.
              </CardContent>
              <CardFooter>
                <Button size="sm">Card Action</Button>
              </CardFooter>
            </Card>
            <div className="mt-6">
              <UsageList
                items={[
                  'Card is our main layout building block for structured content.',
                  'Use CardHeader for heading text, CardContent for the body, and CardFooter for actions.',
                  'This should probably become one of the most common wrappers in the app.',
                ]}
              />
            </div>
          </Section>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Developer Notes</CardTitle>
            <CardDescription>
              This is the first migrated batch from the generated Figma export.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Components currently available: button, badge, card, input, label,
              textarea, separator, switch, tabs, select.
            </p>
            <p>
              The purpose of this page is not end-user polish. It is to help us
              understand the primitives before we use them in real Teamder pages.
            </p>
            <p>
              Next step can be either migrating more primitives like accordion and
              dialog, or starting real screens using this smaller stable set.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/">Return to landing page</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

export default TestGalleryPage
