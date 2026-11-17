// An em dash in user-facing copy reads as machine-written text. Strings and
// JSX text use a comma, colon, full stop or pipe instead. Comments are not
// copy and are left alone.

const EM_DASH = "—";

const noEmDash = {
  meta: {
    type: "problem",
    messages: {
      emDash:
        "No em dashes in copy. Use a comma, colon or full stop in prose, ' | ' in a tab title, or an en dash (–) for an empty value.",
    },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text === "string" && text.includes(EM_DASH)) {
        context.report({ node, messageId: "emDash" });
      }
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.raw),
      JSXText: (node) => check(node, node.value),
    };
  },
};

export default {
  meta: { name: "copy" },
  rules: { "no-em-dash": noEmDash },
};
