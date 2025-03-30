# React Template

This project is a React template using TypeScript, Tailwind CSS, and ShadCN components. It provides a structured starting point for building modern web applications.

## Getting Started

## Guidelines

- All files MUST BE in kebab-case naming style (e.g. `my-new-component.tsx`).

## Adding Pages

You can create new pages under the `src/pages/*` folder, following the structure `src/pages/[my-page-name]/index.tsx` and then you can make your pages accessible by adding your routes at `src/menuData/menu.json` as a new element of `navMain` or `navSecondary` (for secondary routes) and importing the component at `src/routes/index.tsx` under the `<AppLayout />`. AVOID replace the `AppLayout` or usage outside of the `src/routes/index.tsx`.

## Available Components

The following components are available in this template:

- `Accordion`: A collapsible accordion component.
- `Alert`: A component for displaying alerts.
- `AlertDialog`: A dialog component for alerts.
- `AspectRatio`: A component for maintaining aspect ratio.
- `Avatar`: A component for displaying user avatars.
- `Badge`: A badge component for displaying status or counts.
- `Breadcrumb`: A breadcrumb navigation component.
- `Button`: A customizable button component. Read more at https://ui.shadcn.com/docs/components/button#usage.
- `Calendar`: A calendar component.
- `Card`: A card component for displaying content, read more at https://ui.shadcn.com/docs/components/card#usage.
- `Carousel`: A carousel component for sliding content.
- `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`: A set of components to display charts, read more at https://ui.shadcn.com/docs/components/chart#your-first-chart. DO NOT use `Chart` directly.
- `Checkbox`: A checkbox component.
- `Collapsible`: A collapsible component.
- `ContextMenu`: A context menu component.
- `Dialog`: A dialog component. Read more at https://ui.shadcn.com/docs/components/dialog#usage.
- `Drawer`: A drawer component.
- `DropdownMenu`: A dropdown menu component.
- `Input`: A basic input component.
- `InputOTP`: An OTP input component.
- `Label`: A label component.
- `Menubar`: A menubar component.
- `NavigationMenu`: A navigation menu component.
- `Pagination`: A pagination component.
- `Popover`: A popover component.
- `Progress`: A progress bar component.
- `RadioGroup`: A radio group component.
- `Select`: A select dropdown component.
- `Separator`: A separator component.
- `Sidebar`: A sidebar component.
- `Skeleton`: A skeleton loading component.
- `Slider`: A slider component.
- `Switch`: A switch component.
- `Table`: A table component. Read more at https://ui.shadcn.com/docs/components/table#usage.
- `TableHeader`: A table `thead` component.
- `TableBody`: A table `tbody` component.
- `TableFooter`: A table `tfoot` component.
- `TableHead`: A table `th` component.
- `TableRow`: A table `tr` component.
- `TableCell`: A table `td` component.
- `TableCaption`: A table `caption` component.
- `Tabs`: A tabs component.
- `Textarea`: A textarea component.
- `Toast`: A toast notification component.
- `Toaster`: A toaster component for managing toasts. Is already imported within `src/main.tsx`.
- `Toggle`: A toggle button component.
- `Tooltip`: A tooltip component.

> Components are pre-installed from "shadcn/ui" and can be used directly in your components by importing them from `@/ui/base/[component-name]`. See more at "shadcn/ui" components documentation as `https://ui.shadcn.com/docs/components/[component-name]` or at shadcn/charts documentation as `https://ui.shadcn.com/docs/components/chart` for more details on how to use these components.

## Available Hooks

The following hooks are available in this template under the "src/hooks/[hook-name].tsx" route.

- `useToast`: A hook for managing toast notifications. Read more at https://ui.shadcn.com/docs/components/toast#usage
- `useTheme`: A hook for accessing the current theme context.
- `useIsMobile`: A hook for detecting if the current viewport is mobile-sized.

## Using Tailwind CSS

Tailwind CSS is used for styling. Refer to https://tailwindcss.com/docs/styling-with-utility-classes for more details on which classes are available to use.

## Using Lucide Icons

For icons, use the "lucide-react" library to find the appropriate icon for the module. See more at https://lucide.dev/icons/.

```typescript
import { PlusIcon } from "lucide-react";
```

## Using Aliases

The alias `@/` is already set up to refer to the `src/` folder. This simplifies imports, making them cleaner and easier to manage.

```typescript
import { Button } from "@/ui/base/button";
```
