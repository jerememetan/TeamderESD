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
import ModuleBlock from '../../components/schematic/ModuleBlock'
import SystemTag from '../../components/schematic/SystemTag'
import styles from './TestGalleryPage.module.css'

function CodePill({ children }) {
  return <code className={styles.codePill}>{children}</code>
}

function UsageList({ items }) {
  return (
    <div className={styles.usageList}>
      {items.map((item) => (
        <p key={item} className={styles.usageItem}>{item}</p>
      ))}
    </div>
  )
}

function Section({ componentId, title, description, children }) {
  return (
    <ModuleBlock componentId={componentId} eyebrow="Component Reference" title={title}>
      <p className={styles.sectionDescription}>{description}</p>
      {children}
    </ModuleBlock>
  )
}

function TestGalleryPage() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>[DEVELOPER SCHEMATIC GALLERY]</p>
          <h1 className={styles.title}>Teamder component console</h1>
          <p className={styles.description}>
            This page is our internal UI handbook. Each module previews a primitive,
            shows the intended Teamder usage, and captures the prop or composition
            pattern to remember while we build real screens.
          </p>
        </div>
        <div className={styles.heroActions}>
          <SystemTag tone="neutral">Developer Reference</SystemTag>
          <Button asChild variant="outline">
            <Link to="/">Back Home</Link>
          </Button>
        </div>
      </section>

      <ModuleBlock componentId="MOD-G00" eyebrow="Operating Notes" title="How To Read This Page">
        <div className={styles.readGrid}>
          <div className={styles.readCard}>
            <p className={styles.readTitle}>Preview</p>
            <p className={styles.readText}>See how the component actually looks inside the Teamder schematic system.</p>
          </div>
          <div className={styles.readCard}>
            <p className={styles.readTitle}>Usage Notes</p>
            <p className={styles.readText}>Quick guidance on where the primitive should appear in real product screens.</p>
          </div>
          <div className={styles.readCard}>
            <p className={styles.readTitle}>API Hints</p>
            <p className={styles.readText}>Short reminders like <CodePill>variant</CodePill>, <CodePill>asChild</CodePill>, or composition rules.</p>
          </div>
        </div>
      </ModuleBlock>

      <div className={styles.grid}>
        <Section
          componentId="MOD-G01"
          title="Buttons and Badges"
          description="Use buttons for actions and badges for short status labels."
        >
          <div className={styles.codeRow}>
            <CodePill>{'<Button variant="outline" />'}</CodePill>
            <CodePill>{'<Button asChild />'}</CodePill>
            <CodePill>{'<Badge variant="secondary" />'}</CodePill>
          </div>
          <div className={styles.previewRow}>
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          <Separator className={styles.separator} />
          <div className={styles.previewRow}>
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Alert</Badge>
          </div>
          <UsageList
            items={[
              'Use Button for main user actions like save, submit, create team, or view details.',
              'Use Badge for tiny status labels like Open, Draft, Assigned, or Pending.',
              'Use asChild on Button when the clickable element should really be a Link.',
            ]}
          />
        </Section>

        <Section
          componentId="MOD-G02"
          title="Inputs"
          description="Core form inputs for profile forms, filters, and setup flows."
        >
          <div className={styles.codeRow}>
            <CodePill>{'<Input placeholder="..." />'}</CodePill>
            <CodePill>{'<Label htmlFor="..." />'}</CodePill>
            <CodePill>{'<Textarea />'}</CodePill>
            <CodePill>{'<Select><SelectTrigger /></Select>'}</CodePill>
          </div>
          <div className={styles.stack}>
            <div className={styles.fieldStack}>
              <Label htmlFor="student-name">Student name</Label>
              <Input id="student-name" placeholder="Alicia Tan" />
            </div>
            <div className={styles.fieldStack}>
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
            <div className={styles.fieldStack}>
              <Label htmlFor="student-bio">Short bio</Label>
              <Textarea id="student-bio" placeholder="Interested in backend APIs and integration work." />
            </div>
          </div>
          <UsageList
            items={[
              'Wrap visible field names with Label and connect them using htmlFor and id.',
              'Use Input for short values, Textarea for free text, and Select when choices are constrained.',
              'Useful for student onboarding, team preferences, and course configuration forms.',
            ]}
          />
        </Section>

        <Section
          componentId="MOD-G03"
          title="Switches and Settings"
          description="Binary settings for feature flags and simple yes-or-no preferences."
        >
          <div className={styles.codeRow}>
            <CodePill>{'<Switch checked={state} onCheckedChange={setState} />'}</CodePill>
            <CodePill>{'checked'}</CodePill>
            <CodePill>{'onCheckedChange'}</CodePill>
          </div>
          <div className={styles.switchPanel}>
            <div>
              <Label htmlFor="notifications">Enable notifications</Label>
              <p className={styles.readText}>Example toggle for future team alerts.</p>
            </div>
            <Switch id="notifications" checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
          </div>
          <UsageList
            items={[
              'Use Switch only for immediate on/off state, not for choosing between many options.',
              'Good examples: notifications, allow swaps, enable auto-grouping, show archived teams.',
            ]}
          />
        </Section>

        <Section
          componentId="MOD-G04"
          title="Tabs"
          description="Section switching inside a page without navigating to a full new route."
        >
          <div className={styles.codeRow}>
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
            <TabsContent value="overview" className={styles.tabsContent}>Overview content preview.</TabsContent>
            <TabsContent value="members" className={styles.tabsContent}>Members content preview.</TabsContent>
            <TabsContent value="settings" className={styles.tabsContent}>Settings content preview.</TabsContent>
          </Tabs>
          <UsageList
            items={[
              'Use Tabs when the user stays on the same screen context but needs to switch sections.',
              'Good examples: team details, course dashboard sections, analytics breakdowns.',
              'Avoid tabs when the content should really be a separate page with its own route.',
            ]}
          />
        </Section>

        <Section
          componentId="MOD-G05"
          title="Card Layout"
          description="Default content container for dashboards, summaries, and grouped UI blocks."
        >
          <div className={styles.codeRow}>
            <CodePill>{'<Card />'}</CodePill>
            <CodePill>{'<CardHeader />'}</CodePill>
            <CodePill>{'<CardContent />'}</CodePill>
            <CodePill>{'<CardFooter />'}</CodePill>
          </div>
          <Card className={styles.cardPreview}>
            <CardHeader>
              <CardTitle>Example Card</CardTitle>
              <CardDescription>Use this pattern to group related information and actions.</CardDescription>
            </CardHeader>
            <CardContent className={styles.cardCopy}>
              This could become a student profile summary, team card, project card,
              or a dashboard metrics panel.
            </CardContent>
            <CardFooter>
              <Button size="sm">Card Action</Button>
            </CardFooter>
          </Card>
          <UsageList
            items={[
              'Card is our main layout building block for structured content.',
              'Use CardHeader for heading text, CardContent for the body, and CardFooter for actions.',
              'This should be one of the most common wrappers in the app.',
            ]}
          />
        </Section>
      </div>

      <ModuleBlock componentId="MOD-G99" eyebrow="Current Developer Notes" title="Primitive Inventory">
        <div className={styles.notesStack}>
          <p className={styles.readText}>Components currently available: button, badge, card, input, label, textarea, separator, switch, tabs, select.</p>
          <p className={styles.readText}>This page exists to help us understand the primitives before we use them in real Teamder screens.</p>
          <p className={styles.readText}>Next step can be either migrating more primitives like accordion and dialog, or starting real screens using this smaller stable set.</p>
        </div>
        <div className={styles.footerActions}>
          <Button asChild>
            <Link to="/">Return to landing page</Link>
          </Button>
        </div>
      </ModuleBlock>
    </main>
  )
}

export default TestGalleryPage
