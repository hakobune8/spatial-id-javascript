# リリース手順

この文書は`@hakobune8/spatial-id-javascript`の保守者向けです。GitHub Releaseを公開すると、[publish workflow](.github/workflows/publish.yml)がReleaseのタグをcheckoutし、npm Trusted Publishing（OIDC）で同じversionを公開します。

## 初回公開

パッケージがnpm registryにまだ存在しない状態ではTrusted Publisherを登録できません。初回のみ、npmで2FAを使用して手動公開します。

```sh
npm login
npm whoami
npm publish --access public
```

初回公開後、npmjs.comのpackage settingsでTrusted Publisherを次の内容で登録します。

- Provider: GitHub Actions
- Organization or user: `hakobune8`
- Repository: `spatial-id-javascript`
- Workflow filename: `publish.yml`
- Environment: 未指定
- Allowed actions: `npm publish`

この設定後は長期的な`NPM_TOKEN`は不要です。

## 2回目以降の公開

1. `package.json`のversionを更新し、変更を`main`へmergeします。
2. `v`と同じversionを組み合わせたタグを指定してGitHub Releaseを作成します。例えばversionが`0.1.1`の場合、タグは`v0.1.1`です。
3. Releaseを公開すると、GitHub Actionsがテストとtarball検証を行ってからnpmへpublishします。

通常のReleaseはnpmの`latest`タグ、GitHub上でprereleaseに指定したReleaseは`next`タグとして公開されます。

workflowは次の条件を検証します。

- GitHub Releaseのタグが`package.json`のversionと一致する
- ESM、CommonJS、TypeScriptから生成tarballを利用できる
- 同じversionがnpm registryに未公開である

初回手動公開と同じversionのGitHub Releaseを後から作成した場合、publish済みのversionは安全にskipされます。
