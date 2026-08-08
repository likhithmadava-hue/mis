//! The developer recovery **public** key, embedded in the app.
//!
//! This is the counterpart to the private key held only by vohrim, which never
//! ships and lives outside this project at `D:\MIS(Dev)\dev_keys`.
//!
//! Every vault's data key is wrapped a second time with this public key, so a
//! user can send their `vault.mis` + `vault.key` and the developer can decrypt
//! it offline. Nobody without the private key can. Publishing this public key is
//! safe — that is the whole point of public-key crypto.
//!
//! **This is deliberately the same key the Python host used.** Changing it would
//! strand every vault already on disk: the DPAPI wrap would still open on the
//! original machine, but the recovery path — the only way back in after a
//! Windows reinstall or profile loss — would be gone.

pub const DEV_PUBLIC_KEY_PEM: &str = "\
-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA31wXqX2iaRGFv4rtNBiL
vg1ofsY7NgktiZKrX1CUX9Bgil+kltnKc+vTF4yhLL3t5PWc1YLRMEIRJ/NhcWlI
w5cR1y87GJ093l/PbHihZh+xtdWPr6kypwsmz53bnnfoQJMWcNxyqQlpi7uQxNx/
Dr9SaL9noOC6GK97buhwG6vwB1VSoFHuYW17BQluBGdmQbu1AA2RkrRczItJjc3O
Ud7OhJSNxkgDWJ4jLFqVxZ/ansqyP4OPoxOrqUNhwbgQRHZd+jQ2o4JYuYlXBDNL
c/oONarP1sDuHS6nbCYgBOENb3+5Z7BPXZbQsch+Q9Mg/00+wx38wXPaxlMuwBfQ
YCi+jo4TBE1cEx5bbs6figQOPADhn9uDmgmal6RPMt4ZuVeNixr9BwbwkasXfOUO
wQdfFYNjuDHVkiZxgk0ysSCk/Kbq4+PWpJfuEjI5AC+VtJyN5tDTzYim4gqZS7aE
9GVWMpbfYtCyXKEAWktFldXeNSLVKHPsSF3VeagMIyCTAgMBAAE=
-----END PUBLIC KEY-----
";
