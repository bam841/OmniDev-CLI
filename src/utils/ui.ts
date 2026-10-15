import chalk from "chalk";
import boxen from "boxen";
import ora, { type Ora } from "ora";

export function banner(title: string = "OmniDev CLI", subtitle: string = "Autonomous AI Multi-Agent Engine"): string {
  const content = `${chalk.bold.cyan(title)}\n${chalk.dim(subtitle)}`;
  return boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderColor: "cyan",
    borderStyle: "round",
  });
}

export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: "cyan",
  });
}

export function successBox(title: string, message: string): string {
  return boxen(`${chalk.bold.green(title)}\n\n${message}`, {
    padding: 1,
    margin: 1,
    borderColor: "green",
    borderStyle: "round",
  });
}

export function errorBox(title: string, message: string): string {
  return boxen(`${chalk.bold.red(title)}\n\n${message}`, {
    padding: 1,
    margin: 1,
    borderColor: "red",
    borderStyle: "round",
  });
}

export function infoBox(title: string, message: string): string {
  return boxen(`${chalk.bold.blue(title)}\n\n${message}`, {
    padding: 1,
    margin: 1,
    borderColor: "blue",
    borderStyle: "round",
  });
}

export const log = {
  info: (msg: string) => console.log(`${chalk.cyan("ℹ")} ${msg}`),
  success: (msg: string) => console.log(`${chalk.green("✔")} ${msg}`),
  warn: (msg: string) => console.log(`${chalk.yellow("⚠")} ${msg}`),
  error: (msg: string) => console.error(`${chalk.red("✖")} ${msg}`),
  dim: (msg: string) => console.log(chalk.dim(msg)),
};
