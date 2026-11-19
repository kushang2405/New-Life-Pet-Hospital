import unittest

from table_parser import merge_pages, parse_page


def det(text, x, y, score=0.97, h=20):
    return {'text': text, 'x': float(x), 'y': float(y), 'score': score, 'h': float(h)}


class CbcParsingTest(unittest.TestCase):
    def test_reads_both_panels_with_flags_and_units(self):
        detections = [
            det('Para', 290, 136), det('Result', 430, 136), det('Unit', 540, 136),
            det('Para', 640, 136), det('Result', 790, 136), det('Unit', 900, 136),
            det('WBC', 300, 182), det('8.70', 430, 182), det('10^9/L', 572, 182),
            det('MCV', 640, 182), det('H', 745, 182), det('89.9', 800, 182), det('fL', 885, 182),
            det('PLR', 300, 516), det('+++++', 430, 516),
            det('RDW-CV', 655, 473), det('0.160', 800, 473),
        ]
        rows = parse_page(detections, 1429, 'CBC')
        by_name = {row['name']: row for row in rows}

        self.assertEqual(by_name['WBC']['result'], '8.70')
        self.assertEqual(by_name['WBC']['unit'], '10^9/L')
        self.assertEqual(by_name['WBC']['section'], 'CBC')
        self.assertEqual(by_name['MCV']['result'], '89.9')
        self.assertEqual(by_name['MCV']['remarks'], 'H')
        self.assertEqual(by_name['MCV']['unit'], 'fL')
        self.assertEqual(by_name['RDW-CV']['result'], '0.160')
        self.assertTrue(by_name['PLR']['needsReview'])
        self.assertFalse(by_name['WBC']['needsReview'])

    def test_reads_combined_flag_and_number_and_normalizes_units(self):
        detections = [
            det('Para', 290, 136), det('Result', 430, 136), det('Unit', 540, 136),
            det('Para', 640, 136), det('Result', 790, 136), det('Unit', 900, 136),
            # Combined 'H 22.06'
            det('WBC', 300, 182), det('H 22.06', 430, 182), det('10^9/L', 572, 182),
            # Combined 'H 67.7'
            det('MCV', 640, 182), det('H 67.7', 790, 182), det('fL', 900, 182),
            # Combined 'L 17.7' and unit '9/6' (OCR corruption of %)
            det('HCT', 300, 600), det('L 17.7', 430, 600), det('9/6', 572, 600),
            # Unit '%/%'
            det('Gran%', 300, 450), det('21.7', 430, 450), det('%/%', 572, 450),
        ]
        rows = parse_page(detections, 1429, 'CBC')
        by_name = {row['name']: row for row in rows}

        self.assertEqual(by_name['WBC']['result'], '22.06')
        self.assertEqual(by_name['WBC']['remarks'], 'H')
        self.assertEqual(by_name['WBC']['unit'], '10^9/L')

        self.assertEqual(by_name['MCV']['result'], '67.7')
        self.assertEqual(by_name['MCV']['remarks'], 'H')
        self.assertEqual(by_name['MCV']['unit'], 'fL')

        self.assertEqual(by_name['HCT']['result'], '17.7')
        self.assertEqual(by_name['HCT']['remarks'], 'L')
        self.assertEqual(by_name['HCT']['unit'], '%')

        self.assertEqual(by_name['Gran%']['result'], '21.7')
        self.assertEqual(by_name['Gran%']['unit'], '%')

    def test_orders_parameters_line_by_line_matching_analyser_photo(self):
        detections = [
            det('Para', 290, 136), det('Result', 430, 136), det('Unit', 540, 136),
            det('Para', 640, 136), det('Result', 790, 136), det('Unit', 900, 136),
            det('WBC', 300, 182), det('22.06', 430, 182),
            det('MCV', 640, 182), det('67.7', 790, 182),
            det('Lym#', 300, 220), det('11.27', 430, 220),
            det('MCH', 640, 220), det('21.2', 790, 220),
            det('Mid#', 300, 260), det('6.00', 430, 260),
            det('MCHC', 640, 260), det('31.3', 790, 260),
        ]
        rows = parse_page(detections, 1429, 'CBC')
        names = [r['name'] for r in rows]
        # Must be Line 1 (WBC, MCV), Line 2 (Lym#, MCH), Line 3 (Mid#, MCHC)
        self.assertEqual(names, ['WBC', 'MCV', 'Lym#', 'MCH', 'Mid#', 'MCHC'])

    def test_ignores_histogram_labels_outside_table(self):
        detections = [
            det('Para', 290, 136), det('Unit', 540, 136), det('Para', 640, 136), det('Unit', 900, 136),
            det('WBC', 300, 182), det('8.70', 430, 182),
            det('200', 1230, 182), det('300', 1330, 182),
        ]
        names = [row['name'] for row in parse_page(detections, 1429, 'CBC')]
        self.assertEqual(names, ['WBC'])


class BioParsingTest(unittest.TestCase):
    def test_reads_result_flag_and_reference_range(self):
        detections = [
            det('Assay', 331, 150), det('Result', 480, 150), det('H/L', 630, 150), det('Ref.', 740, 150),
            det('A/G', 330, 300), det('1.20', 480, 300), det('L', 630, 300), det('1.20', 740, 300),
            det('--', 790, 300), det('2.40', 820, 300),
        ]
        rows = parse_page(detections, 1299, 'BIO')
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['name'], 'A/G Ratio')
        self.assertEqual(row['section'], 'Liver Profile')
        self.assertEqual(row['result'], '1.20')
        self.assertEqual(row['remarks'], 'L')
        self.assertEqual(row['referenceRange'], '1.20-2.40')

    def test_keeps_less_than_results_and_skips_buttons(self):
        detections = [
            det('TB', 330, 230), det('<', 470, 230), det('0.0', 500, 230), det('L', 630, 230),
            det('0.2--1.2', 740, 230), det('Print', 1090, 230),
            det('Print', 1090, 540),
        ]
        rows = parse_page(detections, 1299, 'BIO')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['result'], '< 0.0')
        self.assertEqual(rows[0]['referenceRange'], '0.2-1.2')
        self.assertEqual(rows[0]['unit'], 'mg/dL')

    def test_handles_sidebar_and_action_buttons_without_dropping_rows(self):
        detections = [
            det('Reports', 95, 300), det('ALB', 320, 300), det('3.5', 480, 300), det('3.3--5.5', 740, 300), det('Print', 1100, 300),
            det('QC', 95, 350), det('ALT', 320, 350), det('63', 480, 350), det('Save', 1100, 350),
        ]
        rows = parse_page(detections, 1299, 'BIO')
        self.assertEqual(len(rows), 2)
        self.assertEqual([r['name'] for r in rows], ['Albumin', 'Alanine Transaminase (ALT)'])
        self.assertEqual(rows[0]['result'], '3.5')
        self.assertEqual(rows[0]['referenceRange'], '3.3-5.5')
        self.assertEqual(rows[1]['result'], '63')

    def test_handles_out_of_linear_range_dash_results(self):
        detections = [
            det('eGFRcr', 330, 400), det('--', 480, 400), det('Out linear', 850, 395), det('range!', 850, 410),
            det('IBIL', 330, 450), det('--', 480, 450), det('0.0--17.0', 740, 450), det('Out linear range!', 850, 450),
        ]
        rows = parse_page(detections, 1299, 'BIO')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['name'], 'eGFRcr')
        self.assertEqual(rows[0]['result'], '--')
        self.assertEqual(rows[1]['name'], 'Indirect bilirubin')
        self.assertEqual(rows[1]['result'], '--')
        self.assertEqual(rows[1]['referenceRange'], '0.0-17.0')


class MergeTest(unittest.TestCase):
    def test_duplicate_rows_across_photos_keep_first(self):
        first = [{'name': 'U/C Ratio', 'result': '85.256'}]
        second = [{'name': 'U/C Ratio', 'result': '85.256'}, {'name': 'GLU', 'result': '177'}]
        names = [row['name'] for row in merge_pages([first, second])]
        self.assertEqual(names, ['U/C Ratio', 'GLU'])


if __name__ == '__main__':
    unittest.main()
