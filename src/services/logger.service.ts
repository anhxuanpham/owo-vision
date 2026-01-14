import util from "node:util";
import chalk from "chalk";

export class LoggerService {
    log(...args: any[]): void {
        console.log(chalk.bgYellow(new Date().toISOString()), ...args);
    }

    info(...args: any[]): void {
        this.log(chalk.blue("[INFO]"), ...args);
    }

    warn(...args: any[]): void {
        this.log(chalk.yellow("[WARN]"), ...args);
    }

    error(...args: any[]): void {
        this.log(chalk.redBright("[ERROR]"), chalk.redBright(util.format(...args)));
    }

    debug(...args: any[]): void {
        this.log(chalk.magentaBright("[DEBUG]"), chalk.gray(util.format(...args)));
    }
}