import { generateTianji } from "../src/server/generate-service";

function getResponseStatus(result: Awaited<ReturnType<typeof generateTianji>>): number {
  if (result.success) {
    return 200;
  }

  if (result.error.code === "RATE_LIMIT_EXCEEDED") {
    return 429;
  }

  if (result.error.code === "INVALID_INPUT" || result.error.code === "PRESS_TOO_SHORT") {
    return 400;
  }

  return 500;
}

export async function GET(): Promise<Response> {
  return Response.json(
    {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Only POST is allowed."
      }
    },
    { status: 405 }
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: "Request body must be valid JSON."
        }
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateTianji(body, process.env);
    return Response.json(result, {
      status: getResponseStatus(result)
    });
  } catch (error) {
    console.error("[api/generate] unexpected error", error);

    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "生成服务发生未处理异常。"
        }
      },
      { status: 500 }
    );
  }
}
