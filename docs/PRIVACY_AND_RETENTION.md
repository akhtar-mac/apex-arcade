# Privacy and retention

This register does not conclude that any legal, tax, or privacy duty has been met. Owners are unassigned because nobody has been identified in the repository or by an external instruction in this session.

| Subject                             | Accountable person | Decision required                                         | Evidence                                                                           | Deadline | Status           |
| ----------------------------------- | ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | ---------------- |
| Privacy notice                      | unassigned         | Whether any personal data may be collected                | No notice is published from this work                                              | unset    | blocked          |
| Personal-data inventory             | unassigned         | Which fields are necessary for a lawful product           | Phone, role, ledger rows, UTR, and optional screenshot string exist in Postgres    | unset    | inventory only   |
| Retention and deletion              | unassigned         | A lawful period for screenshots and account records       | Purge runs only after `SCREENSHOT_RETENTION_DAYS` is a whole number from 1 to 3650 | unset    | blocked          |
| Access requests and complaints      | unassigned         | Who receives and fulfils them                             | No intake path                                                                     | unset    | blocked          |
| Incident response                   | unassigned         | Severity model and contact                                | Request ids exist; paging does not                                                 | unset    | blocked          |
| Legal and regulatory correspondence | unassigned         | Independent Indian legal review of the exact operation    | No opinion stored here                                                             | unset    | blocked          |
| Tax and TDS                         | unassigned         | Whether TDS applies and who files it                      | No tax conclusion is made                                                          | unset    | blocked          |
| Payment provider                    | unassigned         | An authorised account, if a lawful model exists           | No live provider is connected                                                      | unset    | blocked          |
| Administrative accounts             | unassigned         | Named admin and agent operators with separate credentials | Server roles exist; people do not                                                  | unset    | blocked          |
| Backup and recovery                 | unassigned         | RPO, RTO, encryption, and storage location                | Local disposable restore only                                                      | unset    | partial evidence |
| Security escalation                 | unassigned         | Who receives an external test report                      | Internal checks only                                                               | unset    | blocked          |
| Production deploy and rollback      | unassigned         | Who may deploy, and how a bad deploy is reversed          | `autoDeployTrigger` is off; no deploy was made                                     | unset    | blocked          |

## Screenshot handling

Screenshots are optional strings on transaction rows. They are not treated as proof of payment. The desk still requires a human UTR decision. Logs must not include the image payload. Deletion, when an owner later sets the period, nulls the screenshot field for rows older than the cutoff. It does not delete the transaction, ledger, or audit row. Backup copies made before that purge can still contain the old value until backup retention is defined by the owner.
