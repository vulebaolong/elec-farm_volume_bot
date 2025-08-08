import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

export default function AppError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <h1 className="text-3xl font-bold mb-4">
          ⚠️ {error.status} - {error.statusText}
        </h1>
        <p className="text-muted-foreground">
          {error.data?.message || 'Something went wrong.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-3xl font-bold mb-4">Unexpected Error</h1>
      <p className="text-muted-foreground">
        {(error as Error)?.message || 'Unknown error occurred.'}
      </p>
    </div>
  );
}
