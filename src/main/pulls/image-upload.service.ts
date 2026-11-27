import type { Octokit } from '@octokit/rest'
import { checkPastedImage, type PastedImage } from '@shared/pasted-image.util.ts'

/** The numeric ids of repositories, which the upload endpoint asks for; they never change. */
const repositoryIds = new Map<string, number>()

async function readRepositoryId(octokit: Octokit, repoFull: string) {
  const known = repositoryIds.get(repoFull)
  if (known !== undefined) {
    return known
  }
  const [owner = '', repo = ''] = repoFull.split('/')
  const { data } = await octokit.repos.get({ owner, repo })
  repositoryIds.set(repoFull, data.id)
  return data.id
}

/** What a failed upload means for you: GitHub answers 404 when you cannot write to the repository. */
function explainFailure(failure: unknown) {
  const status = (failure as { status?: number }).status
  if (status === 404) {
    return new Error('Adding images needs write access to the repository')
  }
  if (status === 401 || status === 403) {
    return new Error('GitHub refused the upload; your token may not be allowed to add images')
  }
  return failure
}

/**
 * Uploads an image the way GitHub's web page and `gh --attach` do, against the PR's repository, and returns its URL.
 * The image can only be seen by people who can see the repository.
 */
export async function uploadImage(octokit: Octokit, repoFull: string, image: PastedImage): Promise<string> {
  const problem = checkPastedImage(image.contentType, image.bytes.byteLength)
  if (problem !== null) {
    throw new Error(problem)
  }
  try {
    const { data } = await octokit.request(
      'POST https://uploads.github.com/user-attachments/assets{?name,content_type,repository_id}',
      {
        name: image.name,
        content_type: image.contentType,
        repository_id: await readRepositoryId(octokit, repoFull),
        data: Buffer.from(image.bytes),
        headers: { 'content-type': 'application/octet-stream' },
      },
    )
    const url = (data as { url?: unknown }).url
    if (typeof url !== 'string') {
      throw new Error('GitHub did not say where the image went')
    }
    return url
  } catch (failure) {
    throw explainFailure(failure)
  }
}
