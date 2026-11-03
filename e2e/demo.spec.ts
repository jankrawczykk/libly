import { expect, test, type Page } from '@playwright/test'

async function completeProfileWizard(page: Page) {
  await page.selectOption('#school-type', 'primary')
  await page.getByRole('button', { name: 'Dalej' }).click()

  const categorySelects = page.locator('fieldset select')
  for (let index = 0; index < (await categorySelects.count()); index += 1) {
    await categorySelects.nth(index).selectOption('custom')
  }
  await page.getByRole('button', { name: 'Dalej' }).click()

  const symbolSelects = page.locator('fieldset select')
  for (let index = 0; index < (await symbolSelects.count()); index += 1) {
    await symbolSelects.nth(index).selectOption('present')
  }
  await page
    .getByRole('button', { name: 'Potwierdź i pokaż frekwencję' })
    .click()
}

test('completes the demo journey from login to logout', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: 'Uruchom tryb demo' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Uruchom tryb demo' }).click()
  await expect(page).toHaveURL(/\/dashboard$/u)
  await expect(
    page.getByRole('heading', { name: 'Ustaw profil szkoły' }),
  ).toBeVisible()
  await completeProfileWizard(page)

  await expect(
    page.getByRole('heading', { name: /Frekwencja ogółem/u }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Ustawienia szkoły' }).click()
  await expect(page).toHaveURL(/\/settings$/u)
  await page.getByLabel('Próg krytyczny (procent)').fill('99')
  await page.getByLabel('Próg ostrzegawczy (procent)').fill('100')
  await page.getByRole('button', { name: 'Zapisz ustawienia' }).click()
  await expect(page.getByText('Ustawienia zostały zapisane')).toBeVisible()

  await page.getByRole('link', { name: 'Wróć do frekwencji' }).click()
  await expect(page).toHaveURL(/\/dashboard$/u)
  await expect(page.locator('[data-status="critical"]').first()).toBeVisible()

  await page.getByRole('button', { name: 'Wyloguj' }).click()
  await expect(page).toHaveURL(/\/$/u)
  await expect(page.getByText('Wylogowano bezpiecznie.')).toBeVisible()
})
