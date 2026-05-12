import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

const mocks = vi.hoisted(() => ({
  row: null as {
    chatId: string;
    changeId: string | null;
    worktreePath: string | null;
    projectPath: string;
  } | null
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => desktopRoot,
    getPath: (_name: string) => tmpdir(),
    isPackaged: false
  }
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq')
}));

vi.mock('../../db', () => ({
  getDatabase: () => {
    const chain = {
      select: () => chain,
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      get: () => mocks.row
    };
    return chain;
  },
  subChats: { id: 'subChats.id', chatId: 'subChats.chatId', openspecChangeId: 'subChats.openspecChangeId' },
  chats: { id: 'chats.id', projectId: 'chats.projectId', worktreePath: 'chats.worktreePath' },
  projects: { id: 'projects.id', path: 'projects.path' }
}));

import { registerReadPlanTool } from './read-plan';

async function makeClientServer(boundSubChatId?: string) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerReadPlanTool(server, { boundSubChatId });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function writeChangeFile(root: string, changeId: string, relPath: string, content: string): Promise<void> {
  const absPath = join(root, 'openspec', 'changes', changeId, relPath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, content, 'utf8');
}

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'read-plan-openspec-test-'));
  mocks.row = {
    chatId: 'chat-1',
    changeId: 'add-test',
    worktreePath: null,
    projectPath: tmpRoot
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('read_plan tool OpenSpec changes', () => {
  test('returns OpenSpec apply context files for a sub-chat bound to a change', async () => {
    await writeChangeFile(tmpRoot, 'add-test', '.openspec.yaml', 'name: spec-driven\nversion: 1\n');
    await writeChangeFile(tmpRoot, 'add-test', 'proposal.md', '# Proposal\n\nAdd the thing.\n');
    await writeChangeFile(tmpRoot, 'add-test', 'design.md', '# Design\n\nUse the existing path.\n');
    await writeChangeFile(
      tmpRoot,
      'add-test',
      'specs/widget/spec.md',
      [
        '## ADDED Requirements',
        '',
        '### Requirement: Widget',
        'The system SHALL show a widget.',
        '',
        '#### Scenario: Widget visible',
        '- **WHEN** the user opens the view',
        '- **THEN** the widget is visible',
        ''
      ].join('\n')
    );
    await writeChangeFile(tmpRoot, 'add-test', 'tasks.md', '## 1. Work\n\n- [ ] 1.1 Implement widget\n');

    const { client } = await makeClientServer('sub-1');
    const result = await client.callTool({ name: 'read_plan', arguments: {} });

    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('# OpenSpec Change: add-test');
    expect(text).toContain('Source: openspec:spec-driven');
    expect(text).toContain('State: ready');
    expect(text).toContain('Progress: 0/1 tasks complete');
    expect(text).toContain('## proposal: openspec/changes/add-test/proposal.md');
    expect(text).toContain('Add the thing.');
    expect(text).toContain('## design: openspec/changes/add-test/design.md');
    expect(text).toContain('## specs: openspec/changes/add-test/specs/widget/spec.md');
    expect(text).toContain('## tasks: openspec/changes/add-test/tasks.md');
    expect(text).toContain('- [ ] 1.1 Implement widget');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('source=openspec found=true'));
  });
});
