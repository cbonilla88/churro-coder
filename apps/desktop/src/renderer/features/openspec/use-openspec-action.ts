import { useCallback, useMemo } from 'react';
import { useSetAtom } from 'jotai';
import { appStore } from '../../lib/jotai-store';
import { trpc } from '../../lib/trpc';
import { useAgentSubChatStore } from '../agents/stores/sub-chat-store';
import { applyModeDefaultModelAndSwitchProvider } from '../agents/lib/model-switching';
import { useSubChatMode } from '../agents/hooks/use-sub-chat-mode';
import { openSpecSidebarContextAtomFamily, pendingOpenSpecMessageAtom, type OpenSpecSidebarContext } from './atoms';
import { expandOpenSpecCommand } from './openspec-command-expander';

type OpenSpecActionKind = 'plan' | 'apply';

export function useOpenSpecAction(context: OpenSpecSidebarContext, subChatId: string) {
  const trpcUtils = trpc.useUtils();
  const openSubChatForChange = trpc.openspec.openSubChatForChange.useMutation();
  const updateSubChatMode = trpc.chats.updateSubChatMode.useMutation();
  const setPendingMessage = useSetAtom(pendingOpenSpecMessageAtom);
  const { setMode } = useSubChatMode(subChatId);

  const contextAtom = useMemo(() => openSpecSidebarContextAtomFamily(subChatId), [subChatId]);
  const setSidebarContext = useSetAtom(contextAtom);

  return useCallback(
    async (message: string, kind: OpenSpecActionKind) => {
      const expandedMessage = expandOpenSpecCommand(message);
      const targetMode = kind === 'apply' ? 'execute' : 'plan';
      const resolvedSubChat = await openSubChatForChange.mutateAsync({
        chatId: context.chatId,
        projectId: context.projectId,
        changeId: context.changeId
      });

      const targetSubChatId = resolvedSubChat.id;
      const targetContext = { ...context, changePath: context.changePath || `openspec/changes/${context.changeId}` };

      useAgentSubChatStore.getState().addToAllSubChats({
        id: resolvedSubChat.id,
        name: resolvedSubChat.name || context.changeId,
        mode: resolvedSubChat.mode || 'plan'
      });
      useAgentSubChatStore.getState().addToOpenSubChats(targetSubChatId);
      useAgentSubChatStore.getState().setActiveSubChat(targetSubChatId);

      if (targetSubChatId === subChatId) {
        setSidebarContext(targetContext);
        setMode(targetMode);
      } else {
        appStore.set(openSpecSidebarContextAtomFamily(targetSubChatId), targetContext);
        trpcUtils.chats.getSubChat.setData({ id: targetSubChatId }, (prev) => (prev ? { ...prev, mode: targetMode } : prev));
        useAgentSubChatStore.getState().updateSubChatMode(targetSubChatId, targetMode);
        updateSubChatMode.mutate({ id: targetSubChatId, mode: targetMode });
      }
      applyModeDefaultModelAndSwitchProvider(targetSubChatId, targetMode);

      await trpcUtils.chats.getSubChat.invalidate({ id: targetSubChatId });
      setPendingMessage({ subChatId: targetSubChatId, message: expandedMessage });
      console.log(
        `[openspec/action] changeId=${context.changeId} subChatId=${targetSubChatId} kind=${kind} mode=${targetMode} message=${message.split('\n')[0]}`
      );
    },
    [context, openSubChatForChange, setMode, setPendingMessage, setSidebarContext, subChatId, trpcUtils, updateSubChatMode]
  );
}
