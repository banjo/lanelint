import { describe, expect, it } from 'vite-plus/test';
import { astra, bulletproofReact } from '../src/index.ts';
import { check } from './check.ts';

const user = 'src/features/user';
const valid = {
  [`${user}/models/User.ts`]: [
    "import { UserMapper } from '../mappers/UserMapper.ts';",
    'export type User = { id: string; name: string };',
    'export const User = { from: (dto: unknown) => UserMapper.fromDto(dto) };',
  ].join('\n'),
  [`${user}/mappers/UserMapper.ts`]: [
    "import type { User } from '../models/User.ts';",
    'export const UserMapper = { fromDto: (dto: any): User => ({ id: dto.id, name: dto.full_name }) };',
  ].join('\n'),
  [`${user}/services/UserService.ts`]: [
    "import { User } from '../models/User.ts';",
    'export const UserService = { getUser: async (id: string) => User.from(await fetch(`/users/${id}`).then((r) => r.json())) };',
  ].join('\n'),
  [`${user}/utils/UserUtil.ts`]: [
    "import type { User } from '../models/User.ts';",
    "export const UserUtil = { getInitials: (user: User) => user.name.split(' ').map((n) => n[0]).join('') };",
  ].join('\n'),
  [`${user}/hooks/useUserQuery.ts`]: [
    "import { useQuery } from '@tanstack/react-query';",
    "import { UserService } from '../services/UserService.ts';",
    "export const useUserQuery = (id: string) => useQuery({ queryKey: ['user', id], queryFn: () => UserService.getUser(id) });",
  ].join('\n'),
  [`${user}/hooks/useUser.ts`]: [
    "import { useUserQuery } from './useUserQuery.ts';",
    'export const useUser = (id: string) => useUserQuery(id);',
  ].join('\n'),
  [`${user}/components/UserCard.tsx`]: [
    "import type { User } from '../models/User.ts';",
    "import { UserUtil } from '../utils/UserUtil.ts';",
    'export const UserCard = ({ user }: { user: User }) => <h3>{UserUtil.getInitials(user)}</h3>;',
  ].join('\n'),
  [`${user}/containers/UserListContainer.tsx`]: [
    "import { useUser } from '../hooks/useUser.ts';",
    "import { UserCard } from '../components/UserCard.tsx';",
    "export const UserListContainer = () => { const { data } = useUser('1'); return data && <UserCard user={data} />; };",
  ].join('\n'),
  [`${user}/contexts/UserContext.tsx`]: [
    "import { createContext } from 'react';",
    "import { DEFAULT_USER_ID } from '../constants/userConstants.ts';",
    'export const UserContext = createContext(DEFAULT_USER_ID);',
  ].join('\n'),
  [`${user}/constants/userConstants.ts`]: "export const DEFAULT_USER_ID = '1';",
  [`${user}/index.ts`]: "export { UserListContainer } from './containers/UserListContainer.tsx';",
  'src/common/date/index.ts': "export { DateUtil } from './utils/DateUtil.ts';",
  'src/common/date/utils/DateUtil.ts': 'export const DateUtil = {};',
  [`${user}/utils/__tests__/UserUtil.test.ts`]: [
    "import { UserService } from '../../services/UserService.ts';",
    "import { UserUtil } from '../UserUtil.ts';",
  ].join('\n'),
};

describe('astra', () => {
  it('accepts a feature where each role imports only what it may', async () => {
    expect(await check([astra()], valid)).toEqual([]);
  });

  it('reports imports against the roles', async () => {
    const findings = await check([astra()], {
      ...valid,
      [`${user}/models/User.ts`]: "import { UserService } from '../services/UserService.ts';",
      [`${user}/mappers/UserMapper.ts`]: "import { useUser } from '../hooks/useUser.ts';",
      [`${user}/utils/UserUtil.ts`]: "import { UserService } from '../services/UserService.ts';",
      [`${user}/services/UserService.ts`]: "import { useUser } from '../hooks/useUser.ts';",
      [`${user}/hooks/useUser.ts`]: "import { UserCard } from '../components/UserCard.tsx';",
      [`${user}/components/UserCard.tsx`]: [
        "import { useUser } from '../hooks/useUser.ts';",
        "import { UserService } from '../services/UserService.ts';",
        "import { UserListContainer } from '../containers/UserListContainer.tsx';",
      ].join('\n'),
      [`${user}/containers/UserListContainer.tsx`]: [
        "import { UserService } from '../services/UserService.ts';",
        "import { UserMapper } from '../mappers/UserMapper.ts';",
      ].join('\n'),
    });
    expect(findings).toEqual([
      `${user}/components/UserCard.tsx:1 boundaries/allowed-imports Components must not import containers, hooks, contexts, services, or mappers.`,
      `${user}/components/UserCard.tsx:2 boundaries/allowed-imports Components must not import containers, hooks, contexts, services, or mappers.`,
      `${user}/components/UserCard.tsx:3 boundaries/allowed-imports Components must not import containers, hooks, contexts, services, or mappers.`,
      `${user}/containers/UserListContainer.tsx:1 boundaries/allowed-imports Containers must not import services or mappers.`,
      `${user}/containers/UserListContainer.tsx:2 boundaries/allowed-imports Containers must not import services or mappers.`,
      `${user}/hooks/useUser.ts:1 boundaries/allowed-imports Hooks must not import components or containers.`,
      `${user}/mappers/UserMapper.ts:1 boundaries/allowed-imports Mappers must not import services, hooks, contexts, components, or containers.`,
      `${user}/models/User.ts:1 boundaries/allowed-imports Models must not import services, hooks, contexts, components, or containers.`,
      `${user}/services/UserService.ts:1 boundaries/allowed-imports Services must not import hooks, contexts, components, or containers.`,
      `${user}/utils/UserUtil.ts:1 boundaries/allowed-imports Utils must not import services, hooks, contexts, components, or containers.`,
    ]);
  });

  it('treats contexts like hooks, and constants like models', async () => {
    const findings = await check([astra()], {
      ...valid,
      [`${user}/constants/userConstants.ts`]:
        "import { UserContext } from '../contexts/UserContext.tsx';",
      [`${user}/contexts/UserContext.tsx`]:
        "import { UserCard } from '../components/UserCard.tsx';",
      [`${user}/components/UserCard.tsx`]:
        "import { UserContext } from '../contexts/UserContext.tsx';",
    });
    expect(findings).toEqual([
      `${user}/components/UserCard.tsx:1 boundaries/allowed-imports Components must not import containers, hooks, contexts, services, or mappers.`,
      `${user}/constants/userConstants.ts:1 boundaries/allowed-imports Constants must not import services, hooks, contexts, components, or containers.`,
      `${user}/contexts/UserContext.tsx:1 boundaries/allowed-imports Contexts must not import components or containers.`,
    ]);
  });

  it('lets features and domains use the files their index file exports, without cycles', async () => {
    const findings = await check([astra()], {
      ...valid,
      'src/features/vehicle/index.ts':
        "export { VehicleContainer } from './containers/VehicleContainer.tsx';",
      'src/features/vehicle/containers/VehicleContainer.tsx': [
        "import { UserListContainer } from '../../user/containers/UserListContainer.tsx';",
        "import { UserCard } from '../../user/components/UserCard.tsx';",
        "import { DateUtil } from '../../../common/date/utils/DateUtil.ts';",
      ].join('\n'),
      [`${user}/containers/UserListContainer.tsx`]:
        "import { VehicleContainer } from '../../vehicle/containers/VehicleContainer.tsx';",
    });
    expect(findings).toEqual([
      'src/features/user/containers/UserListContainer.tsx:1 boundaries/no-cycles Dependency cycle: src/features/user -> src/features/vehicle -> src/features/user.',
      'src/features/vehicle/containers/VehicleContainer.tsx:2 boundaries/public-api src/features/user/components/UserCard.tsx is not exported from the entry files of src/features/user.',
    ]);
  });

  it('has features and domains import files, not index files', async () => {
    const findings = await check([astra()], {
      ...valid,
      'src/features/vehicle/index.ts': 'export const VehicleContainer = 1;',
      'src/features/vehicle/utils/VehicleUtil.ts': [
        "import { UserListContainer } from '../../user/index.ts';",
        "import { VehicleContainer } from '../index.ts';",
        "import { DateUtil } from '../../../common/date/index.ts';",
      ].join('\n'),
    });
    expect(findings).toEqual([
      'src/features/vehicle/utils/VehicleUtil.ts:1 boundaries/no-entry-import Import the file you need, not the index.ts, which loads the whole feature or domain.',
      'src/features/vehicle/utils/VehicleUtil.ts:2 boundaries/no-entry-import Import files of src/features/vehicle directly, not its own entry file src/features/vehicle/index.ts.',
      'src/features/vehicle/utils/VehicleUtil.ts:3 boundaries/no-entry-import Import the file you need, not the index.ts, which loads the whole feature or domain.',
    ]);
  });

  it('keeps common code from importing features', async () => {
    const findings = await check([astra()], {
      ...valid,
      'src/common/date/utils/DateUtil.ts':
        "import { UserUtil } from '../../../features/user/utils/UserUtil.ts';",
    });
    expect(findings).toEqual([
      'src/common/date/utils/DateUtil.ts:1 boundaries/allowed-imports Common code must not import features.',
      'src/common/date/utils/DateUtil.ts:1 boundaries/public-api src/features/user/utils/UserUtil.ts is not exported from the entry files of src/features/user.',
    ]);
  });

  it('keeps constants, mappers, models, and utils pure, and React out of services', async () => {
    const findings = await check(
      [astra()],
      {
        ...valid,
        [`${user}/utils/UserUtil.ts`]: [
          "import { readFileSync } from 'node:fs';",
          "export const read = () => localStorage.getItem('user');",
        ].join('\n'),
        [`${user}/mappers/UserMapper.ts`]: "export const toDto = () => fetch('/users');",
        [`${user}/services/UserService.ts`]: [
          "import { useState } from 'react';",
          "import type { ReactNode } from 'react';",
        ].join('\n'),
      },
      { hints: true },
    );
    expect(findings).toEqual([
      `${user}/mappers/UserMapper.ts:1 boundaries/restricted-globals Do not use fetch. Constants, mappers, models, and utils are pure. (Move the code with side effects to a service.)`,
      `${user}/services/UserService.ts:1 boundaries/restricted-packages Do not import react. React code belongs in hooks, contexts, components, and containers. (Move the React code to a hook, and keep this file plain TypeScript.)`,
      `${user}/utils/UserUtil.ts:1 boundaries/restricted-packages Do not import node:fs. Constants, mappers, models, and utils are pure. (Move the code with side effects to a service.)`,
      `${user}/utils/UserUtil.ts:2 boundaries/restricted-globals Do not use localStorage. Constants, mappers, models, and utils are pure. (Move the code with side effects to a service.)`,
    ]);
  });

  it('keeps API calls out of hooks, components, and containers', async () => {
    const findings = await check([astra()], {
      ...valid,
      [`${user}/hooks/useUser.ts`]: "export const useUser = () => fetch('/users');",
      [`${user}/components/UserCard.tsx`]: "export const UserCard = () => { fetch('/users'); };",
    });
    expect(findings).toEqual([
      `${user}/components/UserCard.tsx:1 boundaries/restricted-globals Do not use fetch. API calls belong in services.`,
      `${user}/hooks/useUser.ts:1 boundaries/restricted-globals Do not use fetch. API calls belong in services.`,
    ]);
  });

  it('takes other globs for the roles', async () => {
    const findings = await check([astra({ roles: { services: ['**/api/**'] } })], {
      ...valid,
      [`${user}/api/getUser.ts`]: 'export const getUser = 1;',
      [`${user}/utils/UserUtil.ts`]: "import { getUser } from '../api/getUser.ts';",
    });
    expect(findings).toEqual([
      `${user}/utils/UserUtil.ts:1 boundaries/allowed-imports Utils must not import services, hooks, contexts, components, or containers.`,
    ]);
  });

  it('checks the roles inside Bulletproof React features', async () => {
    const findings = await check([bulletproofReact(), astra()], {
      ...valid,
      'src/lib/api-client.ts': 'export const client = 1;',
      'src/app/router.tsx': "import { UserListContainer } from '../features/user/index.ts';",
      [`${user}/containers/UserListContainer.tsx`]:
        "import { UserService } from '../services/UserService.ts';",
    });
    expect(findings).toEqual([
      `${user}/containers/UserListContainer.tsx:1 boundaries/allowed-imports Containers must not import services or mappers.`,
    ]);
  });
});
