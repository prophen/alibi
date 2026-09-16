import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export interface Intake {
  dir: string;
  entry: string;
  projectRoot: string;
  intent?: string;
}

export class IntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeError";
  }
}

function valueFor(args: string[], option: string, index: number): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new IntakeError(`${option} requires a value`);
  }
  return value;
}

function isPathInside(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent));
}

export function parseIntake(args: string[], cwd = process.cwd()): Intake {
  let dirValue: string | undefined;
  let entry: string | undefined;
  let projectRootValue: string | undefined;
  let intent: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    switch (option) {
      case "--dir":
        dirValue = valueFor(args, option, index);
        index += 1;
        break;
      case "--entry":
        entry = valueFor(args, option, index);
        index += 1;
        break;
      case "--project-root":
        projectRootValue = valueFor(args, option, index);
        index += 1;
        break;
      case "--intent":
        intent = valueFor(args, option, index);
        index += 1;
        break;
      default:
        throw new IntakeError(`unknown option: ${option}`);
    }
  }

  if (!dirValue) {
    throw new IntakeError("--dir is required");
  }
  if (!entry || entry.trim().length === 0) {
    throw new IntakeError("--entry must be a non-empty string");
  }
  if (!projectRootValue) {
    throw new IntakeError("--project-root is required");
  }

  const dir = resolve(cwd, dirValue);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new IntakeError(`--dir must be an existing directory: ${dirValue}`);
  }

  const projectRoot = resolve(cwd, projectRootValue);
  if (!isPathInside(dir, projectRoot)) {
    throw new IntakeError(`--project-root must resolve inside --dir: ${projectRootValue}`);
  }

  return {
    dir,
    entry,
    projectRoot,
    ...(intent === undefined ? {} : { intent }),
  };
}
