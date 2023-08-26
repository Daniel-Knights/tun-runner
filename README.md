# tun-runner

Interactive script runner.

## Usage

```bash
npm i -g tun-runner
```

```json
{
  "scripts": {
    "dev:mod1": "echo mod1",
    "dev:mod2": "echo mod2",
    "dev:mod3": "echo mod3"
  }
}
```

```bash
tun dev
```

Output:

```
? Select script » - Use arrow-keys. Return to submit.
>   dev:mod1
    dev:mod2
    dev:mod3
```

`tun d` would result in the same, as it simply matches all scripts that start with the provided input.

## Notes

- Omitting input provides all scripts as options.
- Exact matches are run without selection.
- Selecting a script that also calls `tun` will throw an error.
