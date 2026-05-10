import { Loader2, Play, CheckCircle2, Circle, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Checkbox } from '../../components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { cn } from '../../lib/utils';
import { parseTasksOutline } from '../../../main/lib/openspec/tasks-outline';
import { parseTaskProgress } from '../../../main/lib/openspec/tasks-parser';
import { useAtom } from 'jotai';
import { useMemo, useState } from 'react';
import { useStreamingStatusStore } from '../agents/stores/streaming-status-store';
import { openSpecStopHandlerAtomFamily } from './atoms';
import { useOpenSpecAction } from './use-openspec-action';

interface OpenSpecTasksViewProps {
  chatId: string;
  subChatId: string;
  projectId: string;
  changeId: string;
  changePath: string;
}

export function OpenSpecTasksView({ chatId, subChatId, projectId, changeId, changePath }: OpenSpecTasksViewProps) {
  const { data, isLoading, error } = trpc.openspec.readChangeFile.useQuery(
    { projectId, changeId, kind: 'tasks' },
    { staleTime: 30_000 }
  );
  const isStreaming = useStreamingStatusStore((s) => s.isStreaming(subChatId));
  const stopHandlerAtom = useMemo(() => openSpecStopHandlerAtomFamily(subChatId), [subChatId]);
  const [stopHandler] = useAtom(stopHandlerAtom);
  const runOpenSpecAction = useOpenSpecAction({ chatId, projectId, changeId, changePath }, subChatId);

  const outline = useMemo(() => (data ? parseTasksOutline(data.content) : null), [data]);
  const progress = useMemo(() => (data ? parseTaskProgress(data.content) : { total: 0, done: 0 }), [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading tasks.md…</span>
      </div>
    );
  }

  if (error || !data || !outline) {
    return <div className="py-20 text-center text-sm text-muted-foreground">tasks.md not found in this change.</div>;
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Run-bar card */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {progress.done} of {progress.total} tasks complete
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isStreaming}
              onClick={() => void runOpenSpecAction('/opsx:verify', 'plan')}>
              Review so far
            </Button>
            {isStreaming && stopHandler ? (
              <Button size="sm" variant="outline" onClick={() => void stopHandler()}>
                <Square className="h-3.5 w-3.5 mr-1.5" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void runOpenSpecAction('/opsx:apply', 'apply')}>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Implement all tasks
              </Button>
            )}
          </div>
        </div>
        <Progress value={pct} />
      </div>

      {/* Sections */}
      {outline.sections.map((section, si) => {
        const sectionDone = section.tasks.filter((t) => t.done).length;
        const sectionTotal = section.tasks.length;
        const allDone = sectionDone === sectionTotal && sectionTotal > 0;
        return (
          <TaskSectionBlock
            key={si}
            title={section.title}
            tasks={section.tasks}
            done={sectionDone}
            total={sectionTotal}
            allDone={allDone}
            isStreaming={isStreaming}
            onRunSection={(scope) => void runOpenSpecAction(`/opsx:apply ${scope}`, 'apply')}
            onRunTask={(scope) => void runOpenSpecAction(`/opsx:apply ${scope}`, 'apply')}
          />
        );
      })}
    </div>
  );
}

function TaskSectionBlock({
  title,
  tasks,
  done,
  total,
  allDone,
  isStreaming,
  onRunSection,
  onRunTask
}: {
  title: string;
  tasks: ReturnType<typeof parseTasksOutline>['sections'][number]['tasks'];
  done: number;
  total: number;
  allDone: boolean;
  isStreaming: boolean;
  onRunSection: (scope: string) => void;
  onRunTask: (scope: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const sectionScope = title.match(/^(\d+)\.?/)?.[1];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2 text-left hover:bg-muted/40 rounded-md px-2 py-1.5 transition-colors group">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          {allDone ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="flex-1 text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {done}/{total}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={isStreaming || !sectionScope}
            onClick={(e) => {
              e.stopPropagation();
              if (sectionScope) onRunSection(sectionScope);
            }}>
            <Play className="h-3 w-3" />
          </Button>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 space-y-0.5">
          {tasks.map((task, ti) => (
            <div
              key={ti}
              className={cn('flex items-start gap-3 px-8 py-1.5 rounded-md text-sm group', task.depth > 0 && 'pl-12')}>
              <Checkbox checked={task.done} disabled className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={cn('text-sm', task.done && 'line-through text-muted-foreground')}>
                  <span className="text-muted-foreground mr-1.5 font-mono text-xs">{task.id}</span>
                  {task.title}
                </span>
                {task.filePath && (
                  <span className="ml-2 text-xs text-muted-foreground font-mono truncate">{task.filePath}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isStreaming}
                onClick={() => onRunTask(task.id)}>
                <Play className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
