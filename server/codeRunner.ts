export interface TestCase {
  id: number;
  input: any[];
  expected: any;
  description?: string;
  isHidden?: boolean;
}

export interface ExecutionResult {
  allPassed: boolean;
  passedTests: number;
  totalTests: number;
  executionTimeMs: number;
  error?: string;
  results: {
    id: number;
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    timeMs: number;
    error?: string;
    isHidden?: boolean;
  }[];
}

const emptyResult = (testCases: TestCase[], error: string): ExecutionResult => ({
  allPassed: false,
  passedTests: 0,
  totalTests: testCases.length,
  executionTimeMs: 0,
  error,
  results: [],
});

/**
 * User code is never evaluated in this process. Configure a dedicated runner
 * service that enforces process, filesystem, network, and resource isolation.
 */
export async function executeCodeInSandbox(
  code: string,
  language: string,
  entryFunctionName: string,
  testCases: TestCase[],
): Promise<ExecutionResult> {
  const runnerUrl = process.env.CODE_RUNNER_URL;
  const runnerToken = process.env.CODE_RUNNER_TOKEN;
  if (!runnerUrl || !runnerToken) {
    return emptyResult(testCases, 'Code execution is unavailable: a dedicated sandbox runner is not configured.');
  }
  try {
    const parsedUrl = new URL(runnerUrl);
    if (parsedUrl.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsedUrl.hostname === 'localhost')) {
      return emptyResult(testCases, 'Sandbox runner configuration must use HTTPS.');
    }
  } catch {
    return emptyResult(testCases, 'Sandbox runner configuration is invalid.');
  }
  if (!['javascript', 'python'].includes(language)) return emptyResult(testCases, `Unsupported language: ${language}`);
  if (typeof code !== 'string' || code.length > 50_000) return emptyResult(testCases, 'Code must be a string of at most 50,000 characters.');

  try {
    const response = await fetch(runnerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runnerToken}`,
      },
      body: JSON.stringify({ code, language, entryFunctionName, testCases, timeoutMs: 3000 }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 408 || response.status === 504) return emptyResult(testCases, 'Execution timed out.');
    if (response.status === 422) return emptyResult(testCases, 'Compilation failed. Check your code syntax.');
    if (!response.ok) return emptyResult(testCases, 'Sandbox runner is unavailable.');
    const result = await response.json() as ExecutionResult;
    if (typeof result.allPassed !== 'boolean' || !Array.isArray(result.results) ||
        !Number.isInteger(result.passedTests) || !Number.isInteger(result.totalTests) ||
        !Number.isFinite(result.executionTimeMs)) {
      return emptyResult(testCases, 'Sandbox runner returned an invalid response.');
    }
    return result;
  } catch (error: any) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return emptyResult(testCases, 'Sandbox runner request timed out.');
    return emptyResult(testCases, 'Sandbox runner is unavailable.');
  }
}
