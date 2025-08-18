// navigateService.ts
let navigateFunction: (path: string) => void;

export const setNavigate = (fn: typeof navigateFunction) => {
    navigateFunction = fn;
};

export const navigateTo = (path: string) => {
    if (!navigateFunction) {
        throw new Error("Navigate function is not set yet");
    }
    navigateFunction(path);
};
